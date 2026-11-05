import assert from 'node:assert/strict'
import { after, before, beforeEach, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick } from 'vue'
import { BlankNode, NamedNode } from 'rdflib'

let server
let useProfileEditorStore
let store

const importedProfileIri = 'https://example.org/imported'
const importedFieldIri = 'https://example.org/imported/field'
const importedTurtle = `
  @prefix sh: <http://www.w3.org/ns/shacl#> .
  <${importedProfileIri}> a sh:NodeShape ; sh:name "Imported" ;
    sh:property <${importedFieldIri}> .
  <${importedFieldIri}> a sh:PropertyShape ; sh:name "Imported field" ;
    sh:description "Source description" ; sh:path <https://example.org/name> ;
    sh:minCount 1 ; sh:node <${importedProfileIri}> .`

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.vite-tests', import.meta.url)),
    // SSR tests must not invalidate the running app's optimized dependencies.
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() } },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  ;({ useProfileEditorStore } = await server.ssrLoadModule('/src/application/profiles/profileEditorStore.ts'))
})

after(async () => {
  await server?.close()
})

beforeEach(() => {
  setActivePinia(createPinia())
  store = useProfileEditorStore()
})

test('creation and synchronous defaults form one undo step', async () => {
  assert.equal(store.canUndo, false)
  assert.equal(store.canRedo, false)
  assert.equal(store.undo(), false)
  assert.equal(store.redo(), false)
  const iri = store.createProfile()
  store.updateShapeField(iri, 'creator', 'Example creator')
  store.updateShapeField(iri, 'label', 'Example profile')
  await nextTick()

  assert.equal(store.canUndo, true)
  assert.equal(store.undo(), true)
  assert.equal(store.profiles.length, 0)
  assert.equal(store.canUndo, false)
  assert.equal(store.canRedo, true)
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].creator, 'Example creator')
  assert.equal(store.nodeShapes[0].label, 'Example profile')
  await nextTick()
  assert.equal(store.canRedo, false)
})

test('a new edit discards redo, while an unchanged value preserves it', async () => {
  const iri = store.createProfile()
  await nextTick()
  store.updateShapeField(iri, 'label', 'First')
  await nextTick()
  store.updateShapeField(iri, 'label', 'Second')
  await nextTick()
  store.undo()
  store.updateShapeField(iri, 'label', 'First')
  await nextTick()
  assert.equal(store.canRedo, true)
  store.updateShapeField(iri, 'label', 'Another branch')
  await nextTick()
  assert.equal(store.canRedo, false)
  assert.equal(store.redo(), false)
  store.undo()
  assert.equal(store.nodeShapes[0].label, 'First')
})

test('nested constraints and RDF term methods survive repeated restoration', async () => {
  const iri = store.createProfile()
  const propertyId = store.createProperty(iri)
  store.setPropertyType(iri, propertyId, 'qualifiedProfile')
  store.setPropertyInlineNodeShape(iri, propertyId, true)
  store.setPropertyInlineNodeShapeLabel(iri, propertyId, 'Original label')
  await nextTick()
  store.setPropertyInlineNodeShapeLabel(iri, propertyId, 'Changed label')
  await nextTick()
  for (let count = 0; count < 2; count += 1) {
    store.undo()
    const property = store.nodeShapes[0].properties[0]
    assert.equal(property.qualifiedValueShape.label, 'Original label')
    assert.ok(property.nodeId instanceof NamedNode)
    assert.equal(property.nodeId.equals(new NamedNode(propertyId)), true)
    assert.equal(property.qualifiedValueShape.inlineNodeShape, true)
    assert.match(store.profiles[0].rawTurtle, /Original label/)
    store.redo()
    assert.equal(store.nodeShapes[0].properties[0].qualifiedValueShape.label, 'Changed label')
  }
})

test('moving and deleting fields can be undone and redone', async () => {
  const source = store.createProfile()
  const target = store.createProfile()
  const propertyId = store.createProperty(source)
  await nextTick()
  store.movePropertyToShape(source, propertyId, target)
  await nextTick()
  store.undo()
  assert.equal(store.applicationProfile.findNodeShape(source).properties[0].nodeId.value, propertyId)
  assert.equal(store.applicationProfile.findNodeShape(target).properties.length, 0)
  store.redo()
  assert.equal(store.applicationProfile.findNodeShape(target).properties[0].nodeId.value, propertyId)
  store.removeProperty(target, propertyId)
  await nextTick()
  store.undo()
  assert.equal(store.applicationProfile.findNodeShape(target).properties[0].nodeId.value, propertyId)
})

test('reset and profile deletion retain recoverable history', async () => {
  const iri = store.createProfile()
  await nextTick()
  store.removeProfile(iri)
  await nextTick()
  store.undo()
  assert.equal(store.profiles[0].iri, iri)
  store.reset()
  await nextTick()
  assert.equal(store.profiles.length, 0)
  store.undo()
  assert.equal(store.profiles[0].iri, iri)
  store.redo()
  assert.equal(store.profiles.length, 0)
})

test('import is restored without refetching or losing source metadata', async () => {
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> .
    <https://example.org/profile> a sh:NodeShape ; sh:property [ sh:path <https://example.org/name> ] .`
  await store.addProfileFromTurtle(turtle, 'imported.ttl')
  await nextTick()
  const exported = store.profiles[0].rawTurtle
  store.undo()
  assert.equal(store.profiles.length, 0)
  store.redo()
  assert.equal(store.profiles[0].source, 'imported.ttl')
  assert.equal(store.profiles[0].origin, 'fetched')
  assert.equal(store.profiles[0].rawTurtle, exported)
  assert.ok(store.nodeShapes[0].properties[0].nodeId instanceof BlankNode)
})

test('history is unavailable while imports are resolving', async () => {
  store.createProfile()
  await nextTick()
  store.isResolvingImports = true
  assert.equal(store.canUndo, false)
  assert.equal(store.canRedo, false)
  assert.equal(store.undo(), false)
  assert.equal(store.redo(), false)
  assert.equal(store.profiles.length, 1)
  store.isResolvingImports = false
  assert.equal(store.undo(), true)
})

test('history retains the most recent 100 undo steps', async () => {
  const iri = store.createProfile()
  await nextTick()
  for (let count = 0; count < 105; count += 1) {
    store.updateShapeField(iri, 'label', `Label ${count}`)
    await nextTick()
  }
  let undoCount = 0
  while (store.undo()) undoCount += 1
  assert.equal(undoCount, 100)
  assert.equal(store.nodeShapes[0].label, 'Label 4')
})

test('copy keeps only field metadata and IRI, with independent localized values', async () => {
  store.lockImportedProfiles = false
  await store.addProfileFromTurtle(`
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    <https://example.org/profile> a sh:NodeShape ; sh:property [
      sh:path <https://example.org/name> ; sh:name "Name"@en, "Bezeichnung"@de ;
      sh:description "A name"@en ; sh:datatype xsd:string ;
      sh:minCount 1 ; sh:maxCount 1 ; sh:pattern "[A-Z]+"
    ] .`, 'metadata.ttl')
  const shape = store.nodeShapes[0]
  const source = shape.properties[0]
  const copyId = store.copyProperty(shape.nodeId.value, source.nodeId.value)
  const copy = store.nodeShapes[0].properties.find(property => property.nodeId.value === copyId)

  assert.notEqual(copyId, source.nodeId.value)
  assert.equal(copy.name, source.name)
  assert.equal(copy.description, source.description)
  assert.equal(copy.path.value, source.path.value)
  assert.deepEqual(copy.nameLiterals, source.nameLiterals)
  assert.deepEqual(copy.descriptionLiterals, source.descriptionLiterals)
  assert.notEqual(copy.nameLiterals, source.nameLiterals)
  assert.notEqual(copy.descriptionLiterals[0], source.descriptionLiterals[0])
  assert.ok(copy.path instanceof NamedNode)
  assert.equal(copy.inherited, undefined)
  assert.equal(copy.minCount, undefined)
  assert.equal(copy.maxCount, undefined)
  assert.equal(copy.pattern, undefined)
  assert.equal(copy.datatype, undefined)
  assert.equal(copy.order, 1)
  store.updatePropertyField(shape.nodeId.value, copyId, 'name', 'Copy name')
  assert.equal(store.nodeShapes[0].properties[0].name, source.name)
})

test('inherited copy belongs to the child and leaves inherited constraints visible', async () => {
  const parent = store.createProfile()
  const child = store.createProfile()
  const fieldId = store.createProperty(parent)
  store.updatePropertyField(parent, fieldId, 'name', 'Shared field')
  store.updatePropertyField(parent, fieldId, 'path', 'https://example.org/shared')
  store.updatePropertyField(parent, fieldId, 'minCount', '1')
  store.setShapeInheritance(child, parent)
  await nextTick()

  const copyId = store.copyProperty(child, fieldId)
  await nextTick()
  store.updatePropertyField(child, copyId, 'maxCount', '3')
  await nextTick()
  const childShape = store.applicationProfile.findNodeShape(child)
  assert.equal(childShape.properties.length, 2)
  assert.equal(childShape.properties[0].inherited, true)
  assert.equal(childShape.properties[0].minCount, 1)
  assert.equal(childShape.properties[1].nodeId.value, copyId)
  assert.equal(childShape.properties[1].inherited, undefined)
  assert.equal(childShape.properties[1].maxCount, 3)
  assert.equal(childShape.properties[1].minCount, undefined)
  assert.equal(store.applicationProfile.findNodeShape(parent).properties.length, 1)
  assert.equal(store.applicationProfile.findNodeShape(parent).properties[0].maxCount, undefined)

  const { buildInheritedPropertyGroups, buildOwnProperties } = await server.ssrLoadModule(
    '/src/presentation/features/editor/inheritanceEditorGraph.ts',
  )
  assert.equal(buildInheritedPropertyGroups(childShape, store.nodeShapes)[0].properties[0].nodeId.value, fieldId)
  assert.equal(buildOwnProperties(childShape, store.nodeShapes)[0].nodeId.value, copyId)

  const exported = store.profiles.find(profile => profile.iri === child).rawTurtle
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const importedChild = parseShaclProfile(exported, 'copy.ttl', 'uploaded', child).nodeShapes[0]
  assert.equal(importedChild.properties.length, 1)
  assert.equal(importedChild.properties[0].path.value, 'https://example.org/shared')
  assert.equal(importedChild.properties[0].maxCount, 3)
  assert.deepEqual(importedChild.inheritedShapeIris, [parent])
})

test('copy and deletion are undoable without changing the original', async () => {
  const iri = store.createProfile()
  const originalId = store.createProperty(iri)
  await nextTick()
  const firstCopyId = store.copyProperty(iri, originalId)
  await nextTick()
  const secondCopyId = store.copyProperty(iri, originalId)
  await nextTick()
  assert.notEqual(firstCopyId, secondCopyId)
  assert.equal(store.nodeShapes[0].properties.length, 3)
  store.undo()
  assert.equal(store.nodeShapes[0].properties.length, 2)
  store.redo()
  assert.equal(store.nodeShapes[0].properties[2].nodeId.value, secondCopyId)
  assert.equal(store.removeProperty(iri, firstCopyId), true)
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].nodeId.value, originalId)
  store.undo()
  assert.equal(store.nodeShapes[0].properties[1].nodeId.value, firstCopyId)
})

test('copy ignores missing profiles and fields without adding history', async () => {
  const iri = store.createProfile()
  await nextTick()
  store.undo()
  assert.equal(store.canRedo, true)
  assert.equal(store.copyProperty(iri, 'missing-field'), null)
  assert.equal(store.copyProperty('missing-profile', 'missing-field'), null)
  await nextTick()
  assert.equal(store.canRedo, true)
  assert.equal(store.profiles.length, 0)
})

test('deleting an inherited field preserves a separate own-property copy', async () => {
  const parent = store.createProfile()
  const child = store.createProfile()
  const originalId = store.createProperty(parent)
  store.setShapeInheritance(child, parent)
  const copyId = store.copyProperty(child, originalId)
  await nextTick()
  assert.equal(store.removeProperty(child, originalId), true)
  await nextTick()
  assert.equal(store.applicationProfile.findNodeShape(parent).properties.length, 0)
  assert.equal(store.applicationProfile.findNodeShape(child).properties.length, 1)
  assert.equal(store.applicationProfile.findNodeShape(child).properties[0].nodeId.value, copyId)
  store.undo()
  assert.equal(store.applicationProfile.findNodeShape(parent).properties[0].nodeId.value, originalId)
  assert.equal(store.applicationProfile.findNodeShape(child).properties.length, 2)
})

test('typing a title across multiple input events is one undo step', async () => {
  const iri = store.createProfile()
  store.updateShapeField(iri, 'label', 'Original title')
  await nextTick()
  store.beginHistoryGroup()
  for (const title of ['N', 'Ne', 'New', 'New title']) {
    store.updateShapeField(iri, 'label', title)
    await nextTick()
  }
  store.endHistoryGroup()
  await nextTick()
  store.undo()
  assert.equal(store.nodeShapes[0].label, 'Original title')
  store.redo()
  assert.equal(store.nodeShapes[0].label, 'New title')
})

test('separate editing sessions and later actions stay separate undo steps', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.updatePropertyField(iri, fieldId, 'name', 'Original field')
  await nextTick()
  for (const name of ['First edit', 'Second edit']) {
    store.beginHistoryGroup()
    store.updatePropertyField(iri, fieldId, 'name', name.slice(0, 2))
    await nextTick()
    store.updatePropertyField(iri, fieldId, 'name', name)
    store.endHistoryGroup()
  }
  const copyId = store.copyProperty(iri, fieldId)
  await nextTick()
  store.undo()
  assert.equal(store.nodeShapes[0].properties.length, 1)
  assert.equal(store.nodeShapes[0].properties[0].name, 'Second edit')
  store.undo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'First edit')
  store.undo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Original field')
  store.redo()
  store.redo()
  store.redo()
  assert.equal(store.nodeShapes[0].properties[1].nodeId.value, copyId)
})

test('undo during an active text edit restores the entire previous title', async () => {
  const iri = store.createProfile()
  store.updateShapeField(iri, 'label', 'Before')
  await nextTick()
  store.beginHistoryGroup()
  store.updateShapeField(iri, 'label', 'A')
  await nextTick()
  store.updateShapeField(iri, 'label', 'After')
  assert.equal(store.undo(), true)
  assert.equal(store.nodeShapes[0].label, 'Before')
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].label, 'After')
})

test('canceling a text edit adds no undo step and preserves redo', async () => {
  const iri = store.createProfile()
  store.updateShapeField(iri, 'label', 'Original')
  await nextTick()
  store.updateShapeField(iri, 'label', 'Later')
  await nextTick()
  store.undo()
  store.beginHistoryGroup()
  store.updateShapeField(iri, 'label', 'Temporary')
  await nextTick()
  store.updateShapeField(iri, 'label', 'Original')
  store.endHistoryGroup()
  await nextTick()
  assert.equal(store.canRedo, true)
  assert.equal(store.redo(), true)
  assert.equal(store.nodeShapes[0].label, 'Later')
})

test('imported profiles are locked by default across every mutation path', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  await nextTick()
  const before = JSON.stringify(store.profiles)
  assert.equal(store.lockImportedProfiles, true)
  assert.equal(store.isShapeLocked(importedProfileIri), true)
  assert.equal(store.isPropertyLocked(importedProfileIri, importedFieldIri), true)

  store.updateShapeField(importedProfileIri, 'label', 'Changed')
  store.updateShapeField(importedProfileIri, 'closed', 'closed')
  store.updateShapeField(importedProfileIri, 'targetClass', 'https://example.org/class')
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'name', 'Changed field')
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'minCount', '9')
  store.setShapeInheritance(importedProfileIri, 'https://example.org/parent')
  store.setPropertyNodeTarget(importedProfileIri, importedFieldIri, null)
  store.setPropertyInlineNodeShape(importedProfileIri, importedFieldIri, true)
  store.setPropertyInlineNodeShapeLabel(importedProfileIri, importedFieldIri, 'Changed')
  store.setPropertyAlternativeTargets(importedProfileIri, importedFieldIri, ['https://example.org/target'])
  store.setPropertyExclusiveDatatypeAlternatives(importedProfileIri, importedFieldIri, [{ datatype: 'https://example.org/type' }])
  store.connectPropertyToShape(importedProfileIri, `ref:${importedFieldIri}`, 'https://example.org/target')
  store.setPropertyType(importedProfileIri, importedFieldIri, 'datatype')
  store.removePropertyTarget(importedProfileIri, importedFieldIri, importedProfileIri)
  assert.equal(store.createProperty(importedProfileIri), null)
  assert.equal(store.copyProperty(importedProfileIri, importedFieldIri), null)
  assert.equal(store.removeProperty(importedProfileIri, importedFieldIri), false)
  assert.equal(store.removeProfile(importedProfileIri).ok, false)
  assert.equal(JSON.stringify(store.profiles), before)
})

test('uploaded profiles are also locked, and the setting unlocks their fields', async () => {
  await store.addTurtleFiles([new File([importedTurtle], 'uploaded.ttl', { type: 'text/turtle' })])
  assert.equal(store.profiles[0].origin, 'uploaded')
  assert.equal(store.isShapeLocked(importedProfileIri), true)
  store.lockImportedProfiles = false
  store.updateShapeField(importedProfileIri, 'label', 'Editable import')
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'name', 'Editable field')
  assert.equal(store.applicationProfile.findNodeShape(importedProfileIri).label, 'Editable import')
  assert.equal(store.applicationProfile.findNodeShape(importedProfileIri).properties[0].name, 'Editable field')
  store.lockImportedProfiles = true
  store.updatePropertyField(importedProfileIri, importedFieldIri, 'name', 'Blocked')
  assert.equal(store.applicationProfile.findNodeShape(importedProfileIri).properties[0].name, 'Editable field')
})

test('locked imports can be inherited, referenced, and copied into editable profiles', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  const importedBefore = JSON.stringify(store.profiles[0])
  const child = store.createProfile()
  store.setShapeInheritance(child, importedProfileIri)
  assert.equal(store.isShapeLocked(child), false)
  assert.equal(store.isPropertyLocked(child, importedFieldIri), true)
  store.updatePropertyField(child, importedFieldIri, 'name', 'Blocked inherited edit')
  assert.equal(store.removeProperty(child, importedFieldIri), false)
  const copyId = store.copyProperty(child, importedFieldIri)
  assert.ok(copyId)
  assert.equal(store.isPropertyLocked(child, copyId), false)
  store.updatePropertyField(child, copyId, 'maxCount', '3')
  store.setPropertyNodeTarget(child, copyId, importedProfileIri)
  assert.equal(store.applicationProfile.findNodeShape(child).properties.find(property => property.nodeId.value === copyId).maxCount, 3)
  const other = store.createProfile()
  const directCopyId = store.copyProperty(importedProfileIri, importedFieldIri, other)
  assert.ok(directCopyId)
  assert.equal(store.movePropertyToShape(importedProfileIri, importedFieldIri, other), false)
  assert.equal(store.movePropertyToShape(other, directCopyId, importedProfileIri), false)
  assert.equal(JSON.stringify(store.profiles.find(profile => profile.iri === importedProfileIri)), importedBefore)
  await nextTick()
  store.undo()
  store.redo()
  assert.equal(JSON.stringify(store.profiles.find(profile => profile.iri === importedProfileIri)), importedBefore)
})

test('undo cannot bypass a re-enabled import lock', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  await nextTick()
  store.lockImportedProfiles = false
  store.updateShapeField(importedProfileIri, 'label', 'Edited while unlocked')
  await nextTick()
  store.lockImportedProfiles = true
  assert.equal(store.canUndo, false)
  assert.equal(store.undo(), false)
  store.lockImportedProfiles = false
  assert.equal(store.undo(), true)
  assert.notEqual(store.applicationProfile.findNodeShape(importedProfileIri).label, 'Edited while unlocked')
})

test('the imported profile lock preference persists between editor sessions', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  })
  try {
    assert.equal(store.lockImportedProfiles, true)
    store.lockImportedProfiles = false
    assert.equal(values.get('editor.lockImportedProfiles'), 'false')
    setActivePinia(createPinia())
    const reopened = useProfileEditorStore()
    assert.equal(reopened.lockImportedProfiles, false)
    reopened.lockImportedProfiles = true
    assert.equal(values.get('editor.lockImportedProfiles'), 'true')
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
    else delete globalThis.localStorage
  }
})

test('locked source connections cannot be edited, but editable fields can still reference imports', async () => {
  await store.addProfileFromTurtle(importedTurtle, 'mps.ttl', importedProfileIri)
  const ownProfile = store.createProfile()
  const ownField = store.createProperty(ownProfile)
  store.setPropertyNodeTarget(ownProfile, ownField, importedProfileIri)
  const { buildEditorStructuralEdges } = await server.ssrLoadModule('/src/presentation/features/editor/editorGraphBuilders.ts')
  const edges = buildEditorStructuralEdges(
    store.rootNodeShapes, store.nodeShapes, undefined, () => {}, undefined, undefined,
    false, false, (shapeIri, propertyNodeId) => !store.isPropertyLocked(shapeIri, propertyNodeId),
  )
  assert.equal(edges.length, 2)
  assert.equal(edges.find(edge => edge.sourceHandle === `ref:${importedFieldIri}`).data.onRemove, undefined)
  assert.equal(typeof edges.find(edge => edge.sourceHandle === `ref:${ownField}`).data.onRemove, 'function')
})

test('class and qualified profiles stay loaded while their canvas visibility is toggled independently', async () => {
  const main = 'https://example.org/main'
  const classProfile = 'https://example.org/class-profile'
  const qualifiedProfile = 'https://example.org/qualified-profile'
  const turtle = `
    @prefix sh: <http://www.w3.org/ns/shacl#> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    <${main}> a sh:NodeShape ; owl:imports <${classProfile}>, <${qualifiedProfile}> ;
      sh:property [ sh:path <https://example.org/class-field> ; sh:class <https://example.org/Class> ],
        [ sh:path <https://example.org/qualified-field> ; sh:qualifiedValueShape <${qualifiedProfile}> ],
        [ sh:path <https://example.org/inline-field> ; sh:qualifiedValueShape [
          a sh:NodeShape ; sh:property [ sh:path <https://example.org/inline-value> ]
        ] ] .
    <${classProfile}> a sh:NodeShape ; sh:targetClass <https://example.org/Class> .
    <${qualifiedProfile}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/value> ] .`
  await store.addTurtleFiles([new File([turtle], 'bundle.ttl', { type: 'text/turtle' })])
  assert.equal(store.profiles.length, 3)
  assert.equal(store.nodeShapes.length, 4)
  assert.deepEqual(store.rootNodeShapes.map(shape => shape.nodeId.value), [main])
  const inlineShape = store.nodeShapes.find(shape => shape.nodeId.termType === 'BlankNode')
  assert.ok(inlineShape)
  const before = JSON.stringify(store.profiles)
  const { collectVisibleShapeNodeDescriptors } = await server.ssrLoadModule('/src/presentation/features/editor/inheritanceEditorGraph.ts')
  const { buildEditorStructuralEdges } = await server.ssrLoadModule('/src/presentation/features/editor/editorGraphBuilders.ts')
  const combinations = [
    [false, false, [main], 0],
    [true, false, [main, classProfile], 1],
    [false, true, [main, qualifiedProfile, inlineShape.nodeId.value], 2],
    [true, true, [main, classProfile, qualifiedProfile, inlineShape.nodeId.value], 3],
    [false, false, [main], 0],
  ]
  for (const [showClasses, showQualified, expectedIris, expectedEdges] of combinations) {
    const descriptors = collectVisibleShapeNodeDescriptors(store.rootNodeShapes, store.nodeShapes, new Set(), showClasses, showQualified)
    assert.deepEqual(new Set(descriptors.map(node => node.representedShapeIri)), new Set(expectedIris))
    const edges = buildEditorStructuralEdges(store.rootNodeShapes, store.nodeShapes, new Set(descriptors.map(node => node.nodeId)), undefined, undefined, undefined, showClasses, showQualified)
    assert.equal(edges.length, expectedEdges)
    assert.equal(JSON.stringify(store.profiles), before)
  }
  const exported = store.profiles.map(profile => profile.rawTurtle).join('\n')
  assert.ok(exported.includes(classProfile))
  assert.ok(exported.includes(qualifiedProfile))
  assert.ok(exported.includes('https://example.org/inline-value'))
})

test('hiding a qualified relation keeps profiles reachable through other constraints', async () => {
  const { propertyGraphTargetIris } = await server.ssrLoadModule('/src/presentation/features/editor/inheritanceEditorGraph.ts')
  const target = new NamedNode('https://example.org/shared-target')
  const property = {
    nodeId: new NamedNode('https://example.org/field'),
    qualifiedValueShape: { node: target },
    alternatives: [{ node: target }],
  }
  assert.deepEqual(propertyGraphTargetIris(property, [], false, false), [target.value])
  assert.deepEqual(propertyGraphTargetIris({ ...property, alternatives: undefined }, [], false, false), [])
  assert.deepEqual(propertyGraphTargetIris({ ...property, alternatives: undefined }, [], false, true), [target.value])
})

test('a fetched profile with a different document IRI still has a visible primary shape', async () => {
  const shapeIri = 'https://example.org/shape'
  await store.addProfileFromTurtle(`@prefix sh: <http://www.w3.org/ns/shacl#> .
    <${shapeIri}> a sh:NodeShape .`, 'fetched.ttl', 'https://example.org/document')
  assert.equal(store.rootNodeShapes[0].nodeId.value, shapeIri)
})

test('class profiles discovered without imports reach the store as hidden locked dependencies', async () => {
  const cls = 'https://example.org/store-linked-class'
  const root = 'https://example.org/store-class-root'
  const linked = 'https://example.org/store-linked-profile'
  const turtle = `@prefix sh: <http://www.w3.org/ns/shacl#> . <${linked}> a sh:NodeShape ; sh:targetClass <${cls}> .`
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(String(input))
    assert.equal(url.searchParams.get('query'), cls)
    return Response.json([{ base_url: linked, definition: turtle, mimeType: 'text/turtle' }])
  })
  try {
    await store.addProfileFromTurtle(`@prefix sh: <http://www.w3.org/ns/shacl#> .
      <${root}> a sh:NodeShape ; sh:property [ sh:path <https://example.org/ref> ; sh:class <${cls}> ] .`, 'class-root.ttl', root)
    await nextTick()
    assert.equal(store.nodeShapes.length, 2)
    assert.deepEqual(store.rootNodeShapes.map(shape => shape.nodeId.value), [root])
    assert.equal(store.isShapeLocked(linked), true)
    assert.equal(store.lastResolveErrors.length, 0)
    store.createProfile()
    await nextTick()
    assert.equal(store.undo(), true)
    assert.equal(store.profiles.length, 2)
    assert.ok(store.applicationProfile.findNodeShape(linked))
  } finally {
    mock.restoreAll()
  }
})

test('deleting the character after a space preserves the space and the grouped undo step', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.updatePropertyField(iri, fieldId, 'name', 'Field B')
  await nextTick()
  store.beginHistoryGroup()
  store.updatePropertyField(iri, fieldId, 'name', 'Field ')
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field ')
  store.updatePropertyField(iri, fieldId, 'name', 'Field C')
  store.endHistoryGroup()
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field C')
  store.undo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field B')
  store.redo()
  assert.equal(store.nodeShapes[0].properties[0].name, 'Field C')
})

test('live profile titles and descriptions preserve whitespace while IRI fields are normalized', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  for (const value of ['A ', 'A  ', 'A  B', ' Leading space']) {
    store.updateShapeField(iri, 'label', value)
    store.updateShapeField(iri, 'description', value)
    store.updatePropertyField(iri, fieldId, 'description', value)
    await nextTick()
    assert.equal(store.nodeShapes[0].label, value)
    assert.equal(store.nodeShapes[0].description, value)
    assert.equal(store.nodeShapes[0].properties[0].description, value)
  }
  store.updatePropertyField(iri, fieldId, 'path', '  https://example.org/term  ')
  assert.equal(store.nodeShapes[0].properties[0].path.value, 'https://example.org/term')
})

test('inline qualified shape labels keep following field names through trailing spaces', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  store.setPropertyType(iri, fieldId, 'qualifiedProfile')
  store.setPropertyInlineNodeShape(iri, fieldId, true)
  store.setPropertyInlineNodeShapeLabel(iri, fieldId, 'Field B')
  store.updatePropertyField(iri, fieldId, 'name', 'Field B')
  for (const value of ['Field ', 'Field C']) {
    store.updatePropertyField(iri, fieldId, 'name', value)
    await nextTick()
    assert.equal(store.nodeShapes[0].properties[0].qualifiedValueShape.label, value)
  }
})

test('xone datatype labels can be cleared and replaced without restoring defaults or dropping spaces', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  const stringType = 'http://www.w3.org/2001/XMLSchema#string'
  const integerType = 'http://www.w3.org/2001/XMLSchema#integer'
  store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [{ datatype: stringType }, { datatype: integerType }])
  await nextTick()
  const alternatives = () => store.nodeShapes[0].properties[0].exclusiveAlternatives
  assert.equal(alternatives()[0].label, 'String')
  store.beginHistoryGroup()
  for (const label of ['Strin', 'Stri', 'Str', 'St', 'S', '', 'T', 'Text ', 'Text label']) {
    store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [
      { datatype: stringType, label },
      { datatype: integerType, label: alternatives()[1].label },
    ])
    await nextTick()
    assert.equal(alternatives()[0].label, label)
    assert.equal(alternatives()[1].label, 'Integer')
    assert.equal(alternatives()[0].datatype.value, stringType)
  }
  store.endHistoryGroup()
  await nextTick()
  store.undo()
  assert.equal(alternatives()[0].label, 'String')
  store.redo()
  assert.equal(alternatives()[0].label, 'Text label')
  const { parseShaclProfile } = await server.ssrLoadModule('/src/infrastructure/shacl/shaclProfileParser.ts')
  const restored = parseShaclProfile(store.profiles[0].rawTurtle, 'xone.ttl', 'uploaded')
  assert.equal(restored.nodeShapes[0].properties[0].exclusiveAlternatives[0].label, 'Text label')
})

test('an empty xone label stays empty when another alternative is updated', async () => {
  const iri = store.createProfile()
  const fieldId = store.createProperty(iri)
  const stringType = 'http://www.w3.org/2001/XMLSchema#string'
  const integerType = 'http://www.w3.org/2001/XMLSchema#integer'
  store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [
    { datatype: stringType, label: '' },
    { datatype: integerType, label: 'Whole number' },
  ])
  await nextTick()
  store.setPropertyExclusiveDatatypeAlternatives(iri, fieldId, [
    { datatype: stringType, label: '' },
    { datatype: integerType, label: 'Updated label' },
  ])
  await nextTick()
  assert.equal(store.nodeShapes[0].properties[0].exclusiveAlternatives[0].label, '')
  assert.equal(store.nodeShapes[0].properties[0].exclusiveAlternatives[1].label, 'Updated label')
})

test('shape code preview uses the selected profile source and stays current without mutating data', async () => {
  const first = store.createProfile()
  const firstField = store.createProperty(first)
  store.updateShapeField(first, 'label', 'First preview profile')
  store.updatePropertyField(first, firstField, 'name', 'First field')
  const second = store.createProfile()
  store.updateShapeField(second, 'label', 'Unrelated preview profile')
  const { useEditorPreviews } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorPreviews.ts')
  const previews = useEditorPreviews({ profileStore: store, profiles: computed(() => store.profiles), toast: { add() {} } })
  const before = JSON.stringify(store.profiles)
  await previews.openShapePreview(store.applicationProfile.findNodeShape(first))
  assert.equal(previews.previewShapeTurtle.value, store.profiles.find(profile => profile.iri === first).rawTurtle)
  assert.ok(previews.previewShapeTurtle.value.includes('First field'))
  assert.ok(!previews.previewShapeTurtle.value.includes('Unrelated preview profile'))
  assert.ok(previews.combinedCanvasShapesTurtle.value.includes('Unrelated preview profile'))
  assert.equal(JSON.stringify(store.profiles), before)
  store.updatePropertyField(first, firstField, 'name', 'Updated field')
  await nextTick()
  assert.ok(previews.previewShapeTurtle.value.includes('Updated field'))
})

test('inherited shape code keeps inheritance references instead of flattening source fields', async () => {
  const parent = store.createProfile()
  const parentField = store.createProperty(parent)
  store.updatePropertyField(parent, parentField, 'name', 'Inherited source field')
  const child = store.createProfile()
  store.setShapeInheritance(child, parent)
  const { useEditorPreviews } = await server.ssrLoadModule('/src/presentation/features/editor/useEditorPreviews.ts')
  const previews = useEditorPreviews({ profileStore: store, profiles: computed(() => store.profiles), toast: { add() {} } })
  await previews.openShapePreview(store.applicationProfile.findNodeShape(child))
  assert.match(previews.previewShapeTurtle.value, /sh:node/)
  assert.ok(!previews.previewShapeTurtle.value.includes('Inherited source field'))
})
