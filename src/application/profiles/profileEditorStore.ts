import { defineStore } from 'pinia'
import { BlankNode, Literal, NamedNode } from 'rdflib'
import { computed, shallowRef, ref, watch } from 'vue'
import { ApplicationProfile, classifyShape, propertyNodeTargets, type NodeShape, type PropertyShape, type ShaclProfile } from '@/domain/profiles'
import {
  importProfileFromTurtle,
  importUploadedProfileFile,
  resolveImportedProfiles,
} from '@/application/profiles/useCases/importShaclProfiles'
import { serializeProfileAsTurtle } from '@/infrastructure/shacl/shaclProfileSerializer'
import { PREFIX_APS } from '@/shared/rdf/rdfConstants'
import { PLACEHOLDER_TERM_IRI_PREFIX } from '@/shared/rdf/placeholderTermIri'
import { defaultDatatypeLabel } from '@/application/profiles/profileEditorCatalogs'
import { buildQuantityProfile, NUMERICAL_VARIABLE_PROFILE, type QuantityDefinition } from '@/application/profiles/quantityGenerator'
import { detachDeletedProfileReferences, planProfileDeletion } from '@/application/profiles/profileDeletion'
import { buildCsvProfile, type CsvHeaderMode, type CsvProfileDefaults } from '@/application/profiles/csvProfile'

/**
 * profileEditorStore
 *
 * Holds the active SHACL profile set for the editor, including imported
 * profiles resolved through owl:imports.
 */
export const useProfileEditorStore = defineStore('profiles', () => {
  const applicationProfile = shallowRef<ApplicationProfile>(new ApplicationProfile())
  const isResolvingImports = ref(false)
  const fitViewRequestTick = ref(0)
  const lockImportedProfiles = ref(typeof localStorage === 'undefined'
    || localStorage.getItem('editor.lockImportedProfiles') !== 'false')
  const lockedShapeIris = computed(() => new Set(applicationProfile.value.list()
    .filter(profile => lockImportedProfiles.value && profile.origin === 'fetched')
    .flatMap(profile => profile.nodeShapes.map(shape => shape.nodeId.value))))

  watch(lockImportedProfiles, value => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('editor.lockImportedProfiles', String(value))
  }, { flush: 'sync' })

  function isShapeLocked(shapeIri: string): boolean {
    return lockedShapeIris.value.has(shapeIri)
  }

  function isPropertyLocked(shapeIri: string, propertyNodeId: string): boolean {
    const property = applicationProfile.value.findNodeShape(shapeIri)?.properties
      .find(candidate => candidate.nodeId.value === propertyNodeId)
    return isShapeLocked(shapeIri) || isShapeLocked(property?.inheritedFromShapeIri ?? shapeIri)
  }
  const lastResolveErrors = ref<Array<{
    iri: string
    error: string
    importedBy: Array<{ iri: string; source: string }>
  }>>([])

  type HistorySnapshot = {
    profiles: ShaclProfile[]
    resolveErrors: typeof lastResolveErrors.value
  }

  const history = shallowRef<HistorySnapshot[]>([{ profiles: [], resolveErrors: [] }])
  const historyIndex = ref(0)
  let historyGroupActive = false
  const canUndo = computed(() => !isResolvingImports.value && historyIndex.value > 0 && canRestoreHistory(historyIndex.value - 1))
  const canRedo = computed(() => !isResolvingImports.value && historyIndex.value < history.value.length - 1 && canRestoreHistory(historyIndex.value + 1))

  function canRestoreHistory(index: number): boolean {
    if (!lockImportedProfiles.value) return true
    const targetProfiles = new Map(history.value[index].profiles.map(profile => [profile.iri, profile]))
    return applicationProfile.value.list().every(profile => {
      const target = targetProfiles.get(profile.iri)
      // Loading or removing a profile remains undoable, like resetting the
      // canvas. Existing locked profile contents must remain unchanged.
      // Uploading a replacement draft can also be undone and redone.
      return profile.origin !== 'fetched' || !target || target.origin !== 'fetched'
        || JSON.stringify(profile) === JSON.stringify(target)
    })
  }

  function recordHistory(): void {
    if (historyGroupActive) return
    const currentProfiles = applicationProfile.value.list()
    if (JSON.stringify(currentProfiles) === JSON.stringify(history.value[historyIndex.value].profiles)) return

    const snapshot = cloneProfileValue({ profiles: currentProfiles, resolveErrors: lastResolveErrors.value })
    // Keep up to 100 undo steps; a new edit discards the redo branch.
    history.value = [...history.value.slice(0, historyIndex.value + 1), snapshot].slice(-101)
    historyIndex.value = history.value.length - 1
  }

  function beginHistoryGroup(): void {
    if (historyGroupActive) return
    // Save any preceding action before collecting the focused field's edits.
    recordHistory()
    historyGroupActive = true
  }

  function endHistoryGroup(): void {
    historyGroupActive = false
    recordHistory()
  }

  function restoreHistory(index: number): void {
    const snapshot = cloneProfileValue(history.value[index])
    const restoredProfile = new ApplicationProfile()
    for (const profile of snapshot.profiles) restoredProfile.upsert(profile)
    historyIndex.value = index
    lastResolveErrors.value = snapshot.resolveErrors
    applicationProfile.value = restoredProfile
  }

  function undo(): boolean {
    if (isResolvingImports.value) return false
    endHistoryGroup()
    if (!canUndo.value) return false
    restoreHistory(historyIndex.value - 1)
    return true
  }

  function redo(): boolean {
    if (isResolvingImports.value) return false
    endHistoryGroup()
    if (!canRedo.value) return false
    restoreHistory(historyIndex.value + 1)
    return true
  }

  // Vue batches synchronous changes so compound actions (e.g. creating a
  // profile and applying its defaults) become a single undo step.
  watch(applicationProfile, recordHistory)

  const profiles = computed<ShaclProfile[]>(() => applicationProfile.value.list())
  const nodeShapes = computed<NodeShape[]>(() => applicationProfile.value.allNodeShapes())

  const rootNodeShapes = computed<NodeShape[]>(() => {
    const hiddenImportedShapeIds = applicationProfile.value.inheritedImportedNodeShapeIds()

    const candidates = nodeShapes.value.filter(nodeShape => {
      const isDirectlyLoadedRoot = profiles.value.some(profile =>
        profile.iri === nodeShape.sourceProfileIri
        && profile.source !== profile.iri
        // Inline qualified shapes belong to the profile's loaded data, but
        // enter the canvas through the qualified-shape visibility switch.
        && profile.nodeShapes[0]?.nodeId.value === nodeShape.nodeId.value,
      )
      if (hiddenImportedShapeIds.has(nodeShape.nodeId.value)) return false
      if (!isDirectlyLoadedRoot) return false
      return true
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
    const result = removeProfiles([iri])
    return result.deleted.length ? { ok: true } : { ok: false, reason: result.skipped[0]?.reason || 'Profile not found.' }
  }

  function profileDeletionPlan(iris: string[], includeParents = false) {
    return planProfileDeletion(profiles.value, iris, lockImportedProfiles.value, includeParents)
  }

  function removeProfiles(iris: string[], includeParents = false) {
    const plan = profileDeletionPlan(iris, includeParents)
    if (!plan.shapeIris.length || isResolvingImports.value) return { ...plan, deleted: [] }
    beginHistoryGroup()
    try {
      const remaining = profiles.value.filter(profile => !plan.profileIris.includes(profile.iri))
      detachDeletedProfileReferences(remaining, plan)
      for (const iri of plan.profileIris) applicationProfile.value.profiles.delete(iri)
      syncSerializedProfiles()
    } finally { endHistoryGroup() }
    return plan
  }

  async function addTurtleFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const importedProfiles = await importUploadedProfileFile(file)
      for (const profile of importedProfiles) {
        applicationProfile.value.upsert(profile)
      }
    }
    await resolveAllImports()
    syncSerializedProfiles()
    fitViewRequestTick.value += 1
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
    fitViewRequestTick.value += 1
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
    const [profile] = await importUploadedProfileFile(file, iri)
    if (!profile) return
    applicationProfile.value.upsert({ ...profile, iri })
    await resolveAllImports()
    syncSerializedProfiles()
    fitViewRequestTick.value += 1
  }

  function reset(): void {
    applicationProfile.value = new ApplicationProfile()
    lastResolveErrors.value = []
  }

  function addCsvProfile(text: string, filename: string, headerMode: CsvHeaderMode = 'auto', delimiter = 'auto', datatypes: readonly (string | undefined)[] = [], defaults: CsvProfileDefaults = {}): string {
    const profile = buildCsvProfile(text, filename, headerMode, delimiter, datatypes, defaults)
    applicationProfile.value.upsert(profile)
    syncSerializedProfiles()
    return profile.iri
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
      path: new NamedNode(`${PLACEHOLDER_TERM_IRI_PREFIX}${uuid}`),
      order: context.shape.properties.filter(property => !property.inherited).length,
      datatype: new NamedNode('http://www.w3.org/2001/XMLSchema#string'),
      editorType: 'datatype',
    }

    context.shape.properties.push(property)
    syncSerializedProfiles()
    return property.nodeId.value
  }

  function copyProperty(shapeIri: string, propertyNodeId: string, targetShapeIri = shapeIri): string | null {
    const context = findEditableShapeContext(targetShapeIri)
    const source = applicationProfile.value.findNodeShape(shapeIri)?.properties
      .find(property => property.nodeId.value === propertyNodeId)
    if (!context || !source) return null

    const copy: PropertyShape = {
      nodeId: new NamedNode(`${targetShapeIri}#property-shape-${crypto.randomUUID()}`),
      ...cloneProfileValue({
        name: source.name,
        nameLiterals: source.nameLiterals,
        description: source.description,
        descriptionLiterals: source.descriptionLiterals,
        path: source.path,
      }),
      order: context.shape.properties.filter(property => !property.inherited).length,
    }
    context.shape.properties.push(copy)
    syncSerializedProfiles()
    return copy.nodeId.value
  }

  function canCreateConnectedProfileFromProperty(shapeIri: string, propertyNodeId: string): boolean {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    return Boolean(context && propertyNodeTargets(context.property).length === 0 && !context.property.cls)
  }

  function createConnectedProfileFromProperty(shapeIri: string, propertyNodeId: string): string | null {
    if (!canCreateConnectedProfileFromProperty(shapeIri, propertyNodeId)) return null
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return null
    const label = context.property.name?.trim() ? context.property.name : 'Unnamed field'
    const iri = createProfile()
    updateShapeField(iri, 'label', label)
    setPropertyType(shapeIri, propertyNodeId, 'profile')
    setPropertyNodeTarget(shapeIri, propertyNodeId, iri)
    return iri
  }

  function addQuantityFromProperty(shapeIri: string, propertyNodeId: string, definition: QuantityDefinition, dependencies: ShaclProfile[]): string {
    return addQuantityProfile(definition, dependencies, { shapeIri, propertyNodeId })
  }

  function addQuantityProfile(definition: QuantityDefinition, dependencies: ShaclProfile[], connection?: { shapeIri: string; propertyNodeId: string }): string {
    if (connection && !canCreateConnectedProfileFromProperty(connection.shapeIri, connection.propertyNodeId)) throw new Error('This field is locked, missing, or already connected.')
    if (![...profiles.value, ...dependencies].some(profile => profile.nodeShapes.some(shape => shape.nodeId.value === NUMERICAL_VARIABLE_PROFILE))) throw new Error('The m4i Numerical Variable profile must be loaded first.')
    const generated = buildQuantityProfile(`${PREFIX_APS}${crypto.randomUUID()}`, definition)
    const context = connection ? findEditablePropertyContext(connection.shapeIri, connection.propertyNodeId)! : null
    beginHistoryGroup()
    try {
      for (const dependency of dependencies) {
        if (!applicationProfile.value.profiles.has(dependency.iri)) applicationProfile.value.upsert(cloneProfileValue(dependency))
      }
      applicationProfile.value.upsert(generated)
      if (context && connection) {
        setPropertyType(connection.shapeIri, connection.propertyNodeId, 'qualifiedProfile')
        for (const key of ['minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive', 'pattern', 'defaultValue', 'allowedValueLabels', 'conjunctions', 'negatedConstraint'] as const) delete context.property[key]
        context.property.path = new NamedNode(definition.path)
        context.property.name = definition.name.trim()
        context.property.nameLiterals = [{ value: definition.name.trim(), lang: 'en' }]
        context.property.qualifiedValueShape = {
          node: new NamedNode(generated.iri),
          inlineNodeShape: true,
          label: definition.name.trim(),
        }
        context.property.qualifiedMinCount = definition.minCount
        context.property.qualifiedMaxCount = definition.maxCount ?? undefined
        context.property.minCount = undefined
        context.property.maxCount = undefined
      }
      syncSerializedProfiles()
    } finally {
      endHistoryGroup()
    }
    return generated.iri
  }

  function createConnectedPropertyFromProfile(shapeIri: string, targetShapeIri: string): string | null {
    const context = findEditableShapeContext(shapeIri)
    const target = applicationProfile.value.findNodeShape(targetShapeIri)
    if (!context || !target) return null
    const propertyNodeId = createProperty(shapeIri)
    if (!propertyNodeId) return null
    updatePropertyField(shapeIri, propertyNodeId, 'name', target.label?.trim() ? target.label : 'Unnamed profile')
    setPropertyType(shapeIri, propertyNodeId, 'profile')
    setPropertyNodeTarget(shapeIri, propertyNodeId, targetShapeIri)
    return propertyNodeId
  }

  function updateShapeField(shapeIri: string, field: EditableShapeField, value: string | null): void {
    const context = findEditableShapeContext(shapeIri)
    if (!context) return

    if (field === 'targetClass') {
      context.shape.targetClass = value?.trim() ? new NamedNode(value.trim()) : undefined
    } else if (field === 'closed') {
      context.shape.closed = value === 'closed'
    } else {
      context.shape[field] = field === 'label' || field === 'description'
        ? value || undefined
        : normalizeString(value)
      if (field === 'label') {
        context.shape.labelLiterals = undefined
        context.shape.rdfsLabelLiterals = undefined
      } else if (field === 'description') {
        context.shape.descriptionLiterals = undefined
      }
    }

    syncSerializedProfiles()
  }

  function updateProfileUrl(profileIri: string, value: string): { ok: boolean; reason?: string } {
    const profile = applicationProfile.value.profiles.get(profileIri)
    if (!profile) return { ok: false, reason: 'Profile not found.' }
    if (lockImportedProfiles.value && profile.origin === 'fetched') {
      return { ok: false, reason: 'Imported profiles are locked for editing in Settings.' }
    }
    const iri = value.trim()
    if (!/^[a-z][a-z0-9+.-]*:[^\s<>"{}|^`\\]+$/i.test(iri)) {
      return { ok: false, reason: 'Enter a valid absolute URL or IRI.' }
    }
    try {
      new URL(iri)
    } catch {
      return { ok: false, reason: 'Enter a valid absolute URL or IRI.' }
    }
    if (iri === profileIri) return { ok: true }
    if (applicationProfile.value.profiles.has(iri)
      || applicationProfile.value.rawNodeShapes().some(shape => shape.nodeId.value === iri)
      || applicationProfile.value.rawNodeShapes().some(shape => shape.properties.some(property => property.nodeId.value === iri))) {
      return { ok: false, reason: 'This URL is already used by a profile or shape.' }
    }

    // Rename identities and shape references, preserving vocabulary terms,
    // field identifiers, literals, and the original import source.
    function renameReferences(candidate: ShaclProfile): ShaclProfile {
      const next = cloneProfileValue(candidate)
      next.imports = next.imports.map(reference => reference === profileIri ? iri : reference)
      for (const shape of next.nodeShapes) {
        if (shape.sourceProfileIri === profileIri) shape.sourceProfileIri = iri
        if (shape.nodeId.value === profileIri) shape.nodeId = new NamedNode(iri)
        shape.inheritedShapeIris = shape.inheritedShapeIris?.map(reference => reference === profileIri ? iri : reference)
        for (const property of shape.properties) {
          const constraints = [property, property.qualifiedValueShape, property.negatedConstraint,
            ...property.alternatives ?? [], ...property.conjunctions ?? [], ...property.exclusiveAlternatives ?? []]
          for (const constraint of constraints) {
            if (constraint?.node?.value === profileIri) constraint.node = new NamedNode(iri)
          }
        }
      }
      if (candidate.iri === profileIri) next.iri = iri
      return next
    }

    const renamed = applicationProfile.value.list().map(renameReferences)
    const lockedReference = renamed.some(candidate => {
      const original = applicationProfile.value.profiles.get(candidate.iri)
      return original && lockImportedProfiles.value && original.origin === 'fetched'
        && JSON.stringify(original) !== JSON.stringify(candidate)
    })
    if (lockedReference) return { ok: false, reason: 'A locked profile references this URL. Unlock imported profiles in Settings before changing it.' }

    const next = new ApplicationProfile()
    for (const candidate of renamed) next.upsert(candidate)
    applicationProfile.value = next
    syncSerializedProfiles()
    return { ok: true }
  }

  function updatePropertyField(shapeIri: string, propertyNodeId: string, field: EditablePropertyField, value: string | null): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return
    const property = context.property

    // Keep user-entered whitespace in live text fields. Trimming on each
    // keystroke feeds a shortened value back into the focused input.
    const normalized = field === 'name' || field === 'description'
      ? value || undefined
      : normalizeString(value)
    const previousName = property.name
    switch (field) {
      case 'hasValues': {
        const rows = JSON.parse(value || '[]') as Array<{ value: string; datatype: string; language?: string }>
        property.hasValues = rows.map(row => row.datatype === '@iri' ? new NamedNode(row.value)
          : row.datatype === '@blank' ? new BlankNode(row.value)
            : row.datatype === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
              ? new Literal(row.value, row.language || 'en')
              : new Literal(row.value, '', new NamedNode(row.datatype)))
        break
      }
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
        property.allowedValueLabels = filterAllowedValueLabels(property.allowedValueLabels, property.allowedValues)
        break
      case 'allowedValueLabels': {
        const entries = parseAllowedValueLabelEntries(normalized)
        property.allowedValues = entries.map(entry => entry.value)
        property.allowedValueLabels = entries.reduce<NonNullable<PropertyShape['allowedValueLabels']>>((labels, entry) => {
          if (entry.label) labels[entry.value] = [{ value: entry.label, lang: 'en' }]
          return labels
        }, {})
        if (Object.keys(property.allowedValueLabels).length === 0) property.allowedValueLabels = undefined
        break
      }
      case 'alternativeTargets': {
        const constraints = normalized
          ? normalized
            .split(/\r?\n|,/)
            .map(entry => entry.trim())
            .filter(Boolean)
            .map(value => ({ node: new NamedNode(value) }))
          : []
        if (property.editorType === 'exactlyOneOfProfiles') {
          property.exclusiveAlternatives = constraints
          property.alternatives = undefined
        } else {
          property.alternatives = constraints
          property.exclusiveAlternatives = undefined
        }
        break
      }
      default:
        property[field] = normalized as never
        if (field === 'name') {
          property.nameLiterals = undefined
          if (
            property.qualifiedValueShape?.inlineNodeShape
            && (!property.qualifiedValueShape.label || property.qualifiedValueShape.label === previousName)
          ) {
            property.qualifiedValueShape.label = normalized
          }
        } else if (field === 'description') {
          property.descriptionLiterals = undefined
        }
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
      if (property.editorType === 'qualifiedProfile') {
        property.qualifiedValueShape = {
          ...property.qualifiedValueShape,
          node: new NamedNode(target),
        }
        property.node = undefined
      } else if (property.editorType === 'exactlyOneOfProfiles') {
        property.exclusiveAlternatives = [{ node: new NamedNode(target) }]
        property.alternatives = undefined
        property.node = undefined
      } else if (property.editorType === 'oneOfProfiles') {
        property.alternatives = [{ node: new NamedNode(target) }]
        property.exclusiveAlternatives = undefined
        property.node = undefined
      } else {
        property.node = new NamedNode(target)
        property.qualifiedValueShape = undefined
        property.qualifiedMinCount = undefined
        property.qualifiedMaxCount = undefined
        property.editorType = 'profile'
      }
      property.datatype = undefined
      property.hasValues = undefined
      property.nodeKind = undefined
      property.cls = undefined
      property.allowedValues = undefined
    } else {
      property.node = undefined
      property.alternatives = undefined
      property.exclusiveAlternatives = undefined
      property.qualifiedValueShape = undefined
      property.qualifiedMinCount = undefined
      property.qualifiedMaxCount = undefined
      if (property.editorType === 'profile' || property.editorType === 'qualifiedProfile' || property.editorType === 'oneOfProfiles' || property.editorType === 'exactlyOneOfProfiles') {
        property.datatype = new NamedNode('http://www.w3.org/2001/XMLSchema#string')
        property.editorType = 'datatype'
      }
    }
    syncSerializedProfiles()
  }

  function setPropertyInlineNodeShape(shapeIri: string, propertyNodeId: string, enabled: boolean): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context || context.property.editorType !== 'qualifiedProfile') return

    const constraint = context.property.qualifiedValueShape ?? {}
    constraint.inlineNodeShape = enabled || undefined
    if (enabled) {
      constraint.label ||= context.property.name?.trim() || 'Unnamed field'
    } else {
      constraint.label = undefined
      constraint.description = undefined
    }
    context.property.qualifiedValueShape = constraint
    syncSerializedProfiles()
  }

  function setPropertyInlineNodeShapeLabel(shapeIri: string, propertyNodeId: string, label: string | null): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context?.property.qualifiedValueShape?.inlineNodeShape) return

    context.property.qualifiedValueShape.label = normalizeString(label)
      ?? context.property.name?.trim()
      ?? 'Unnamed field'
    syncSerializedProfiles()
  }

  function setPropertyAlternativeTargets(shapeIri: string, propertyNodeId: string, targetShapeIris: string[]): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return

    const normalizedTargets = [...new Set(targetShapeIris.map(value => value.trim()).filter(Boolean))]

    const constraints = normalizedTargets.map(value =>
      value ? { node: new NamedNode(value) } : {},
    )
    const exclusive = context.property.editorType === 'exactlyOneOfProfiles'
    context.property.alternatives = exclusive ? undefined : constraints
    context.property.exclusiveAlternatives = exclusive ? constraints : undefined
    context.property.editorType = exclusive ? 'exactlyOneOfProfiles' : 'oneOfProfiles'
    context.property.hasValues = undefined
    context.property.node = undefined
    context.property.datatype = undefined
    context.property.nodeKind = undefined
    context.property.cls = undefined
    context.property.allowedValues = undefined
    context.property.qualifiedValueShape = undefined
    context.property.qualifiedMinCount = undefined
    context.property.qualifiedMaxCount = undefined
    syncSerializedProfiles()
  }

  function setPropertyExclusiveDatatypeAlternatives(
    shapeIri: string,
    propertyNodeId: string,
    alternatives: Array<{ datatype: string; label?: string }>,
  ): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return

    context.property.hasValues = undefined
    context.property.datatype = undefined
    context.property.node = undefined
    context.property.nodeKind = undefined
    context.property.cls = undefined
    context.property.allowedValues = undefined
    context.property.alternatives = undefined
    context.property.exclusiveAlternatives = alternatives
      .map(alternative => ({
        datatype: alternative.datatype.trim(),
        label: alternative.label,
      }))
      .filter(alternative => alternative.datatype)
      .map(alternative => ({
        datatype: new NamedNode(alternative.datatype),
        // An explicitly empty label is a valid edit, not a request to
        // restore the generated label while the user is replacing it.
        label: alternative.label ?? defaultDatatypeLabel(alternative.datatype),
      }))
    context.property.qualifiedValueShape = undefined
    context.property.qualifiedMinCount = undefined
    context.property.qualifiedMaxCount = undefined
    context.property.editorType = 'exactlyOneOfDatatypes'
    syncSerializedProfiles()
  }

  function connectPropertyToShape(shapeIri: string, sourceHandle: string | null | undefined, targetShapeIri: string | null): void {
    if (!sourceHandle?.startsWith('ref:')) return
    const propertyNodeId = sourceHandle.slice('ref:'.length).trim()
    if (!propertyNodeId) return
    const context = findEditableShapeContext(shapeIri)
    if (!context) return

    const property = context.shape.properties.find(candidate => candidate.nodeId.value === propertyNodeId)
    if (!property) return
    if (property.editorType === 'class' && targetShapeIri?.trim()) {
      const targetShape = applicationProfile.value.findNodeShape(targetShapeIri.trim())
      if (!targetShape?.targetClass) return
      property.cls = new NamedNode(targetShape.targetClass.value)
      syncSerializedProfiles()
      return
    }
    if ((property.editorType === 'oneOfProfiles' || property.editorType === 'exactlyOneOfProfiles') && targetShapeIri?.trim()) {
      const alternatives = property.editorType === 'exactlyOneOfProfiles' ? property.exclusiveAlternatives : property.alternatives
      const existing = alternatives?.map(alternative => alternative.node?.value).filter((value): value is string => Boolean(value)) ?? []
      if (!existing.includes(targetShapeIri.trim())) {
        setPropertyAlternativeTargets(shapeIri, property.nodeId.value, [...existing, targetShapeIri.trim()])
      }
      return
    }
    setPropertyNodeTarget(shapeIri, property.nodeId.value, targetShapeIri)
  }

  function setPropertyType(shapeIri: string, propertyNodeId: string, type: PropertyEditorType): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return

    const property = context.property
    property.hasValues = undefined
    property.datatype = undefined
    property.node = undefined
    property.nodeKind = undefined
    property.cls = undefined
    property.allowedValues = undefined
    property.alternatives = undefined
    property.exclusiveAlternatives = undefined
    property.qualifiedValueShape = undefined
    property.qualifiedMinCount = undefined
    property.qualifiedMaxCount = undefined
    property.editorType = type

    if (type === 'value') {
      property.hasValues = []
    } else if (type === 'datatype') {
      property.datatype = new NamedNode('http://www.w3.org/2001/XMLSchema#string')
    } else if (type === 'nodeKind') {
      property.nodeKind = new NamedNode('http://www.w3.org/ns/shacl#IRI')
    } else if (type === 'class') {
      property.cls = undefined
    } else if (type === 'profile') {
      property.node = undefined
    } else if (type === 'qualifiedProfile') {
      property.qualifiedValueShape = {}
    } else if (type === 'oneOfProfiles') {
      property.alternatives = []
    } else if (type === 'exactlyOneOfProfiles') {
      property.exclusiveAlternatives = []
    } else if (type === 'exactlyOneOfDatatypes') {
      property.exclusiveAlternatives = []
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

  function movePropertyToShape(sourceShapeIri: string, propertyNodeId: string, targetShapeIri: string, targetIndex?: number): boolean {
    const sourceContext = findEditableShapeContext(sourceShapeIri)
    const targetContext = findEditableShapeContext(targetShapeIri)
    if (!sourceContext || !targetContext) return false

    const sourceIndex = sourceContext.shape.properties.findIndex(property => property.nodeId.value === propertyNodeId)
    if (sourceIndex < 0) return false

    const property = sourceContext.shape.properties[sourceIndex]
    if (!property || property.inherited) return false

    sourceContext.shape.properties.splice(sourceIndex, 1)
    const requestedIndex = targetIndex ?? targetContext.shape.properties.length
    const insertionIndex = sourceShapeIri === targetShapeIri && requestedIndex > sourceIndex
      ? clampIndex(requestedIndex - 1, targetContext.shape.properties.length)
      : clampIndex(requestedIndex, targetContext.shape.properties.length)
    targetContext.shape.properties.splice(insertionIndex, 0, property)
    normalizePropertyOrder(sourceContext.shape)
    if (sourceShapeIri !== targetShapeIri) normalizePropertyOrder(targetContext.shape)
    syncSerializedProfiles()
    return true
  }

  function removePropertyTarget(shapeIri: string, propertyNodeId: string, targetShapeIri: string): void {
    const context = findEditablePropertyContext(shapeIri, propertyNodeId)
    if (!context) return

    const property = context.property
    if (property.cls) {
      const targetShape = applicationProfile.value.findNodeShape(targetShapeIri)
      if (targetShape?.targetClass?.value === property.cls.value) {
        property.cls = undefined
        if (property.editorType === 'class') {
          property.datatype = new NamedNode('http://www.w3.org/2001/XMLSchema#string')
          property.editorType = 'datatype'
        }
        syncSerializedProfiles()
        return
      }
    }

    if (property.editorType === 'oneOfProfiles' || property.editorType === 'exactlyOneOfProfiles') {
      const alternatives = property.editorType === 'exactlyOneOfProfiles' ? property.exclusiveAlternatives : property.alternatives
      const remaining = alternatives
        ?.map(alternative => alternative.node?.value)
        .filter((value): value is string => Boolean(value) && value !== targetShapeIri) ?? []

      const constraints = remaining.map(value => ({ node: new NamedNode(value) }))
      if (property.editorType === 'exactlyOneOfProfiles') property.exclusiveAlternatives = constraints
      else property.alternatives = constraints
      syncSerializedProfiles()
      return
    }

    if (property.editorType === 'qualifiedProfile' || property.editorType === 'profile') {
      setPropertyNodeTarget(shapeIri, propertyNodeId, null)
    }
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
        if (property.qualifiedValueShape?.node?.value === shapeIri) {
          references.add(`${shape.label ?? shape.nodeId.value} / ${property.name ?? property.path?.value ?? property.nodeId.value}`)
        }
        if ([...property.alternatives ?? [], ...property.exclusiveAlternatives ?? []].some(alternative => alternative.node?.value === shapeIri)) {
          references.add(`${shape.label ?? shape.nodeId.value} / ${property.name ?? property.path?.value ?? property.nodeId.value}`)
        }
      }
    }

    return [...references]
  }

  function profilesImporting(importIri: string): Array<{ iri: string; source: string }> {
    return applicationProfile.value
      .list()
      .filter(profile => profile.imports.includes(importIri)
        || profile.nodeShapes.some(shape => shape.properties.some(property => property.cls?.value === importIri)))
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
    if (isShapeLocked(shapeIri)) return null
    for (const profile of applicationProfile.value.list()) {
      const shape = profile.nodeShapes.find(candidate => candidate.nodeId.value === shapeIri)
      if (shape) return { profile, shape }
    }
    return null
  }

  function findEditablePropertyContext(shapeIri: string, propertyNodeId: string): { profile: ShaclProfile; shape: NodeShape; property: PropertyShape } | null {
    if (isPropertyLocked(shapeIri, propertyNodeId)) return null
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
    lockImportedProfiles,
    lockedShapeIris,
    isShapeLocked,
    isPropertyLocked,
    isResolvingImports,
    fitViewRequestTick,
    lastResolveErrors,
    lastResolveErrorsSummary,
    canUndo,
    canRedo,
    beginHistoryGroup,
    endHistoryGroup,
    undo,
    redo,
    removeProfile,
    removeProfiles,
    profileDeletionPlan,
    createProfile,
    addCsvProfile,
    createProperty,
    copyProperty,
    createConnectedProfileFromProperty,
    addQuantityFromProperty,
    addQuantityProfile,
    canCreateConnectedProfileFromProperty,
    createConnectedPropertyFromProfile,
    removeProperty,
    movePropertyToShape,
    updateShapeField,
    updateProfileUrl,
    updatePropertyField,
    setShapeInheritance,
    setPropertyNodeTarget,
    setPropertyInlineNodeShape,
    setPropertyInlineNodeShapeLabel,
    setPropertyAlternativeTargets,
    setPropertyExclusiveDatatypeAlternatives,
    connectPropertyToShape,
    setPropertyType,
    removePropertyTarget,
    listProfileReferences,
    addTurtleFiles,
    addProfileFromTurtle,
    resolveAllImports,
    uploadFallbackForImport,
    reset,
  }
})

// Copy editable data without losing RDF term prototypes or sharing nested
// constraints with a saved history entry.
function cloneProfileValue<T>(value: T): T {
  if (value instanceof Literal) return new Literal(value.value, value.language, new NamedNode(value.datatype.value)) as T
  if (value instanceof NamedNode) return new NamedNode(value.value) as T
  if (value instanceof BlankNode) return new BlankNode(value.value) as T
  if (Array.isArray(value)) return value.map(entry => cloneProfileValue(entry)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneProfileValue(entry)])) as T
  }
  return value
}

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
  | 'hasValues'
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
  | 'allowedValueLabels'
  | 'alternativeTargets'
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

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length
  return Math.max(0, Math.min(length, Math.trunc(index)))
}

function normalizePropertyOrder(shape: NodeShape): void {
  shape.properties
    .filter(property => !property.inherited)
    .forEach((property, index) => {
      property.order = index
    })
}

function filterAllowedValueLabels(
  labels: PropertyShape['allowedValueLabels'],
  allowedValues: string[] | undefined,
): PropertyShape['allowedValueLabels'] {
  if (!labels || !allowedValues) return undefined
  const next: NonNullable<PropertyShape['allowedValueLabels']> = {}
  const allowed = new Set(allowedValues)
  for (const [value, valueLabels] of Object.entries(labels)) {
    if (allowed.has(value)) next[value] = valueLabels
  }
  return Object.keys(next).length > 0 ? next : undefined
}

function parseAllowedValueLabelEntries(value: string | undefined): Array<{ value: string; label?: string }> {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [iri, ...labelParts] = line.split('|')
      return {
        value: iri?.trim() ?? '',
        label: labelParts.join('|').trim() || undefined,
      }
    })
    .filter(entry => entry.value)
}

export type PropertyEditorType = 'datatype' | 'value' | 'nodeKind' | 'class' | 'profile' | 'qualifiedProfile' | 'oneOfProfiles' | 'exactlyOneOfProfiles' | 'exactlyOneOfDatatypes' | 'list'
