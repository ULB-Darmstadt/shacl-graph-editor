import { defineStore } from 'pinia'
import { NamedNode } from 'rdflib'
import { computed, shallowRef, ref } from 'vue'
import { ApplicationProfile, classifyShape, type NodeShape, type PropertyShape, type ShaclProfile } from '@/domain/profiles'
import {
  importProfileFromTurtle,
  importUploadedProfileFile,
  resolveImportedProfiles,
} from '@/application/profiles/useCases/importShaclProfiles'
import { serializeProfileAsTurtle } from '@/infrastructure/shacl/shaclProfileSerializer'
import { PREFIX_APS } from '@/shared/rdf/rdfConstants'

/**
 * profileEditorStore
 *
 * Holds the active SHACL profile set for the editor, including imported
 * profiles resolved through owl:imports.
 */
export const useProfileEditorStore = defineStore('profiles', () => {
  const applicationProfile = shallowRef<ApplicationProfile>(new ApplicationProfile())
  const isResolvingImports = ref(false)
  const lastResolveErrors = ref<Array<{
    iri: string
    error: string
    importedBy: Array<{ iri: string; source: string }>
  }>>([])

  const profiles = computed<ShaclProfile[]>(() => applicationProfile.value.list())
  const nodeShapes = computed<NodeShape[]>(() => applicationProfile.value.allNodeShapes())

  const rootNodeShapes = computed<NodeShape[]>(() => {
    const hiddenImportedShapeIds = applicationProfile.value.inheritedImportedNodeShapeIds()

    const candidates = nodeShapes.value.filter(nodeShape => {
      if (hiddenImportedShapeIds.has(nodeShape.nodeId.value)) return false

      const isDirectlyLoadedRoot = profiles.value.some(profile =>
        profile.iri === nodeShape.sourceProfileIri && profile.source !== profile.iri,
      )
      const kind = classifyShape(nodeShape)
      return isDirectlyLoadedRoot || kind === 'data' || kind === 'reference'
    })

    const inheritedByOtherCandidateIds = new Set(
      candidates.flatMap(nodeShape =>
        (nodeShape.inheritedShapeIris ?? []).filter(inheritedIri => inheritedIri !== nodeShape.nodeId.value),
      ),
    )

    return candidates.filter(nodeShape => {
      if (!inheritedByOtherCandidateIds.has(nodeShape.nodeId.value)) return true
      return classifyShape(nodeShape) !== 'form'
    })
  })

  const hasProfiles = computed(() => applicationProfile.value.hasShapes)

  const lastResolveErrorsSummary = computed(() => {
    if (lastResolveErrors.value.length === 0) return ''

    return lastResolveErrors.value
      .map((entry, index) => {
        const importedBy = entry.importedBy.length > 0
          ? entry.importedBy.map(profile => profile.source || profile.iri).join(', ')
          : 'unknown profile'
        return `${index + 1}. Import ${entry.iri} failed. Referenced by: ${importedBy}. Reason: ${entry.error}`
      })
      .join(' | ')
  })

  function removeProfile(iri: string): { ok: boolean; reason?: string } {
    const blockingReferences = listProfileReferences(iri)
    if (blockingReferences.length > 0) {
      return {
        ok: false,
        reason: `Profile is still referenced by ${blockingReferences.join(', ')}.`,
      }
    }

    applicationProfile.value.profiles.delete(iri)
    syncSerializedProfiles()
    return { ok: true }
  }

  async function addTurtleFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const profile = await importUploadedProfileFile(file)
      applicationProfile.value.upsert(profile)
    }
    await resolveAllImports()
    syncSerializedProfiles()
  }

  async function addProfileFromTurtle(
    turtle: string,
    source: string,
    iri?: string,
  ): Promise<void> {
    const profile = importProfileFromTurtle(turtle, source, 'fetched', iri)
    applicationProfile.value.upsert(profile)
    await resolveAllImports()
    syncSerializedProfiles()
  }

  async function resolveAllImports(): Promise<void> {
    isResolvingImports.value = true
    lastResolveErrors.value = []
    try {
      const result = await resolveImportedProfiles(applicationProfile.value)
      lastResolveErrors.value = result.errors.map(entry => ({
        ...entry,
        importedBy: profilesImporting(entry.iri),
      }))
    } finally {
      isResolvingImports.value = false
    }
  }

  async function uploadFallbackForImport(iri: string, file: File): Promise<void> {
    const profile = await importUploadedProfileFile(file, iri)
    applicationProfile.value.upsert({ ...profile, iri })
    await resolveAllImports()
    syncSerializedProfiles()
  }

  function reset(): void {
    applicationProfile.value = new ApplicationProfile()
    lastResolveErrors.value = []
  }

  function createProfile(): string {
    const uuid = crypto.randomUUID()
    const iri = `${PREFIX_APS}${uuid}`
    const shape: NodeShape = {
      nodeId: new NamedNode(iri),
      properties: [],
      inheritedShapeIris: [],
      closed: false,
      sourceProfileIri: iri,
    }

    applicationProfile.value.upsert({
      iri,
      source: `${uuid}.ttl`,
      origin: 'created',
      rawTurtle: '',
      imports: [],
      nodeShapes: [shape],
    })

    syncSerializedProfiles()
    return iri
  }

  function createProperty(shapeIri: string): string | null {
    const context = findEditableShapeContext(shapeIri)
    if (!context) return null

    const uuid = crypto.randomUUID()
    const propertyNodeIri = `${context.shape.nodeId.value}#property-shape-${uuid}`
    const property: PropertyShape = {
      nodeId: new NamedNode(propertyNodeIri),
      order: context.shape.properties.filter(property => !property.inherited).length,
      datatype: new NamedNode('http://www.w3.org/2001/XMLSchema#string'),
      editorType: 'datatype',
    }

    context.shape.properties.push(property)
    syncSerializedProfiles()
    return property.nodeId.value
  }

  function updateShapeField(shapeIri: string, field: EditableShapeField, value: string | null): void {
    const context = findEditableShapeContext(shapeIri)
    if (!context) return

    if (field === 'targetClass') {
      context.shape.targetClass = value?.trim() ? new NamedNode(value.trim()) : undefined
    } else if (field === 'closed') {
      context.shape.closed = value === 'closed'
    } else {
      context.shape[field] = normalizeString(value)
    }

    syncSerializedProfiles()
  }

  function updatePropertyField(shapeIri: string, propertyNodeId: string, field: EditablePropertyField, value: string | null): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return
    const property = context.property

    const normalized = normalizeString(value)
    switch (field) {
      case 'path':
        property.path = normalized ? new NamedNode(normalized) : undefined
        break
      case 'datatype':
      case 'node':
      case 'nodeKind':
      case 'cls':
      case 'severity':
      case 'equals':
      case 'disjoint':
      case 'lessThan':
      case 'lessThanOrEquals':
        property[field] = normalized ? new NamedNode(normalized) as never : undefined
        break
      case 'minCount':
      case 'maxCount':
      case 'order':
      case 'qualifiedMinCount':
      case 'qualifiedMaxCount':
        property[field] = normalized ? Number(normalized) as never : undefined
        break
      case 'allowedValues':
        property.allowedValues = normalized
          ? normalized.split(/\r?\n|,/).map(entry => entry.trim()).filter(Boolean)
          : []
        break
      default:
        property[field] = normalized as never
        break
    }

    syncSerializedProfiles()
  }

  function setShapeInheritance(shapeIri: string, inheritedShapeIri: string | null): void {
    const context = findEditableShapeContext(shapeIri)
    if (!context) return

    context.shape.inheritedShapeIris = inheritedShapeIri?.trim() ? [inheritedShapeIri.trim()] : []
    syncSerializedProfiles()
  }

  function setPropertyNodeTarget(shapeIri: string, propertyNodeId: string, targetShapeIri: string | null): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return
    const property = context.property
    const target = targetShapeIri?.trim()

    if (target) {
      property.node = new NamedNode(target)
      property.datatype = undefined
      property.nodeKind = undefined
      property.cls = undefined
      property.allowedValues = undefined
      property.editorType = 'profile'
    } else {
      property.node = undefined
      if (property.editorType === 'profile') {
        property.datatype = new NamedNode('http://www.w3.org/2001/XMLSchema#string')
        property.editorType = 'datatype'
      }
    }
    syncSerializedProfiles()
  }

  function connectPropertyToShape(shapeIri: string, sourceHandle: string | null | undefined, targetShapeIri: string | null): void {
    if (!sourceHandle?.startsWith('ref:')) return
    const propertyNodeId = sourceHandle.slice('ref:'.length)
    const context = findEditableShapeContext(shapeIri)
    if (!context) return

    const property = context.shape.properties.find(candidate => candidate.nodeId.value === propertyNodeId)
    if (!property) return
    setPropertyNodeTarget(shapeIri, property.nodeId.value, targetShapeIri)
  }

  function setPropertyType(shapeIri: string, propertyNodeId: string, type: PropertyEditorType): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return

    const property = context.property
    property.datatype = undefined
    property.node = undefined
    property.nodeKind = undefined
    property.cls = undefined
    property.allowedValues = undefined
    property.editorType = type

    if (type === 'datatype') {
      property.datatype = new NamedNode('http://www.w3.org/2001/XMLSchema#string')
    } else if (type === 'nodeKind') {
      property.nodeKind = new NamedNode('http://www.w3.org/ns/shacl#IRI')
    } else if (type === 'profile') {
      property.node = undefined
    } else if (type === 'list') {
      property.allowedValues = []
    }

    syncSerializedProfiles()
  }

  function removeProperty(shapeIri: string, propertyNodeId: string): boolean {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return false

    const index = context.shape.properties.findIndex(property => property.nodeId.value === context.property.nodeId.value)
    if (index < 0) return false
    context.shape.properties.splice(index, 1)
    syncSerializedProfiles()
    return true
  }

  function listProfileReferences(shapeIri: string): string[] {
    const references = new Set<string>()

    for (const shape of applicationProfile.value.rawNodeShapes()) {
      if ((shape.inheritedShapeIris ?? []).includes(shapeIri)) {
        references.add(shape.label ?? shape.nodeId.value)
      }

      for (const property of shape.properties) {
        if (property.node?.value === shapeIri) {
          references.add(`${shape.label ?? shape.nodeId.value} / ${property.name ?? property.path?.value ?? property.nodeId.value}`)
        }
      }
    }

    return [...references]
  }

  function profilesImporting(importIri: string): Array<{ iri: string; source: string }> {
    return applicationProfile.value
      .list()
      .filter(profile => profile.imports.includes(importIri))
      .map(profile => ({
        iri: profile.iri,
        source: profile.source,
      }))
  }

  function syncSerializedProfiles(): void {
    const list = applicationProfile.value.list()
    for (const profile of list) {
      profile.rawTurtle = serializeProfileAsTurtle(profile, list)
    }

    const nextApplicationProfile = new ApplicationProfile()
    for (const profile of list) {
      nextApplicationProfile.upsert(profile)
    }
    applicationProfile.value = nextApplicationProfile
  }

  function findEditableShapeContext(shapeIri: string): { profile: ShaclProfile; shape: NodeShape } | null {
    for (const profile of applicationProfile.value.list()) {
      const shape = profile.nodeShapes.find(candidate => candidate.nodeId.value === shapeIri)
      if (shape) return { profile, shape }
    }
    return null
  }

  function findEditablePropertyContext(shapeIri: string, propertyNodeId: string): { profile: ShaclProfile; shape: NodeShape; property: PropertyShape } | null {
    const directContext = findEditableShapeContext(shapeIri)
    const directProperty = directContext?.shape.properties.find(property => property.nodeId.value === propertyNodeId)
    if (directContext && directProperty) {
      return { ...directContext, property: directProperty }
    }

    const resolvedShape = applicationProfile.value.findNodeShape(shapeIri)
    const resolvedProperty = resolvedShape?.properties.find(property => property.nodeId.value === propertyNodeId)
    const ownerShapeIri = resolvedProperty?.inheritedFromShapeIri
    if (!ownerShapeIri) return null

    const ownerContext = findEditableShapeContext(ownerShapeIri)
    const ownerProperty = ownerContext?.shape.properties.find(property =>
      property.nodeId.value === propertyNodeId
      || property.path?.value === resolvedProperty?.path?.value,
    )

    if (ownerContext && ownerProperty) {
      return { ...ownerContext, property: ownerProperty }
    }

    return null
  }

  return {
    applicationProfile,
    profiles,
    nodeShapes,
    rootNodeShapes,
    hasProfiles,
    isResolvingImports,
    lastResolveErrors,
    lastResolveErrorsSummary,
    removeProfile,
    createProfile,
    createProperty,
    removeProperty,
    updateShapeField,
    updatePropertyField,
    setShapeInheritance,
    setPropertyNodeTarget,
    connectPropertyToShape,
    setPropertyType,
    listProfileReferences,
    addTurtleFiles,
    addProfileFromTurtle,
    resolveAllImports,
    uploadFallbackForImport,
    reset,
  }
})

type EditableShapeField =
  | 'label'
  | 'description'
  | 'creator'
  | 'created'
  | 'license'
  | 'subject'
  | 'closed'
  | 'targetClass'

type EditablePropertyField =
  | 'name'
  | 'description'
  | 'path'
  | 'datatype'
  | 'node'
  | 'nodeKind'
  | 'cls'
  | 'minCount'
  | 'maxCount'
  | 'pattern'
  | 'order'
  | 'defaultValue'
  | 'allowedValues'
  | 'message'
  | 'severity'
  | 'equals'
  | 'disjoint'
  | 'lessThan'
  | 'lessThanOrEquals'
  | 'minInclusive'
  | 'minExclusive'
  | 'maxInclusive'
  | 'maxExclusive'
  | 'qualifiedMinCount'
  | 'qualifiedMaxCount'

function normalizeString(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export type PropertyEditorType = 'datatype' | 'nodeKind' | 'profile' | 'list'
