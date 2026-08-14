const prefixes = {
  sh: 'http://www.w3.org/ns/shacl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

export const defaultDataType = {
  text: "string",
  value: prefixes.xsd + "string",
};
export type SelectionType = typeof defaultDataType;
export const dataTypes = [
  { text: "any", value: prefixes.xsd + "any" },
  { text: "anyType", value: prefixes.xsd + "anyType" },
  { text: "anyURI", value: prefixes.xsd + "anyURI" },
  {
    text: "base64Binary",
    value: prefixes.xsd + "base64Binary",
  },
  { text: "boolean", value: prefixes.xsd + "boolean" },
  { text: "byte", value: prefixes.xsd + "byte" },
  { text: "date", value: prefixes.xsd + "date" },
  {
    text: "dateTime",
    value: prefixes.xsd + "dateTime",
  },
  { text: "decimal", value: prefixes.xsd + "decimal" },
  { text: "double", value: prefixes.xsd + "double" },
  {
    text: "duration",
    value: prefixes.xsd + "duration",
  },
  { text: "ENTITIES", value: prefixes.xsd + "ENTITIES" },
  { text: "ENTITY", value: prefixes.xsd + "ENTITY" },
  { text: "float", value: prefixes.xsd + "float" },
  {
    text: "hexBinary",
    value: prefixes.xsd + "hexBinary",
  },
  { text: "gDay", value: prefixes.xsd + "gDay" },
  { text: "gMonth", value: prefixes.xsd + "gMonth" },
  {
    text: "gMonthDay",
    value: prefixes.xsd + "gMonthDay",
  },
  { text: "gYear", value: prefixes.xsd + "gYear" },
  {
    text: "gYearMonth",
    value: prefixes.xsd + "gYearMonth",
  },
  { text: "hexBinary", value: prefixes.xsd + "hexBinary" },
  { text: "ID", value: prefixes.xsd + "ID" },
  { text: "IDREF", value: prefixes.xsd + "IDREF" },
  { text: "IDREFS", value: prefixes.xsd + "IDREFS" },
  { text: "int", value: prefixes.xsd + "int" },
  { text: "integer", value: prefixes.xsd + "integer" },
  { text: "language", value: prefixes.xsd + "language" },
  { text: "long", value: prefixes.xsd + "long" },
  { text: "Name", value: prefixes.xsd + "Name" },
  { text: "NCName", value: prefixes.xsd + "NCName" },
  { text: "negativeInteger", value: prefixes.xsd + "negativeInteger" },
  { text: "NMTOKEN", value: prefixes.xsd + "NMTOKEN" },
  { text: "NMTOKENS", value: prefixes.xsd + "NMTOKENS" },
  { text: "nonNegativeInteger", value: prefixes.xsd + "nonNegativeInteger" },
  { text: "nonPositiveInteger", value: prefixes.xsd + "nonPositiveInteger" },
  { text: "normalizedString", value: prefixes.xsd + "normalizedString" },
  {
    text: "NOTATION",
    value: prefixes.xsd + "NOTATION",
  },
  { text: "positiveInteger", value: prefixes.xsd + "positiveInteger" },
  { text: "QName", value: prefixes.xsd + "QName" },
  { text: "short", value: prefixes.xsd + "short" },
  defaultDataType,
  { text: "time", value: prefixes.xsd + "time" },
  { text: "token", value: prefixes.xsd + "token" },
  { text: "unsignedByte", value: prefixes.xsd + "unsignedByte" },
  { text: "unsignedInt", value: prefixes.xsd + "unsignedInt" },
  { text: "unsignedLong", value: prefixes.xsd + "unsignedLong" },
  { text: "unsignedShort", value: prefixes.xsd + "unsignedShort" },
];

export const numericDataTypes = dataTypes.filter((type) =>
  [
    "decimal",
    "double",
    "float",
    "integer",
    "long",
    "int",
    "short",
    "byte",
    "nonNegativeInteger",
    "positiveInteger",
    "negativeInteger",
    "nonPositiveInteger",
    "unsignedByte",
    "unsignedInt",
    "unsignedLong",
    "unsignedShort",
  ].includes(type.text),
);

export const nodeKinds = [
  { text: "BlankNode", value: prefixes.sh + "BlankNode" },
  { text: "IRI", value: prefixes.sh + "IRI" },
  { text: "Literal", value: prefixes.sh + "Literal" },
  { text: "BlankNodeOrIRI", value: prefixes.sh + "BlankNodeOrIRI" },
  { text: "BlankNodeOrLiteral", value: prefixes.sh + "BlankNodeOrLiteral" },
  { text: "IRIOrLiteral", value: prefixes.sh + "IRIOrLiteral" },
];

export const severities = [
  { text: "Info", value: prefixes.sh + "Info" },
  { text: "Warning", value: prefixes.sh + "Warning" },
  { text: "Violation", value: prefixes.sh + "Violation" },
];

export const subjects = [
  {
    value: "https://github.com/tibonto/dfgfo/101-01",
    text: "Prehistory and World Archaeology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/101-02",
    text: "Classical Philology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/101-03",
    text: "Ancient History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/101-04",
    text: "Classical Archaeology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/101-05",
    text: "Egyptology and Ancient Near Eastern Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/102-01",
    text: "Medieval History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/102-02",
    text: "Early Modern History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/102-03",
    text: "Modern and Current History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/102-04",
    text: "History of Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/103-01",
    text: "Art History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/103-02",
    text: "Musicology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/103-03",
    text: "Theatre and Media Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/104-01",
    text: "General and Comparative Linguistics, Typology, Non-European Languages",
  },
  {
    value: "https://github.com/tibonto/dfgfo/104-02",
    text: "Individual Linguistics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/104-03",
    text: "Historical Linguistics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/104-04",
    text: "Applied Linguistics, Experimental Linguistics, Computational Linguistics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/105-01",
    text: "Medieval German Literature",
  },
  {
    value: "https://github.com/tibonto/dfgfo/105-02",
    text: "Modern German Literature",
  },
  {
    value: "https://github.com/tibonto/dfgfo/105-03",
    text: "European and American Literature",
  },
  {
    value: "https://github.com/tibonto/dfgfo/105-04",
    text: "General and Comparative Literature and Cultural Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/106-01",
    text: "Social and Cultural Anthropology and Ethnology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/106-02",
    text: "Asian Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/106-03",
    text: "African, American and Oceania Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/106-04",
    text: "Islamic Studies, Arabian Studies, Semitic Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/106-05",
    text: "Religious Studies and Jewish Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/107-01",
    text: "Protestant Theology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/107-02",
    text: "Roman Catholic Theology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/108-01",
    text: "History of Philosophy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/108-02",
    text: "Theoretical Philosophy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/108-03",
    text: "Practical Philosophy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/109-01",
    text: "General Education and History of Education",
  },
  {
    value: "https://github.com/tibonto/dfgfo/109-02",
    text: "General and Domain-Specific Teaching and Learning",
  },
  {
    value: "https://github.com/tibonto/dfgfo/109-03",
    text: "Education Systems and Educational Institutions",
  },
  {
    value: "https://github.com/tibonto/dfgfo/109-04",
    text: "Educational Research on Socialisation, Welfare and Professionalism Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/110-01",
    text: "General, Cognitive and Mathematical Psychology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/110-02",
    text: "Biological Psychology and Cognitive Neuroscience",
  },
  {
    value: "https://github.com/tibonto/dfgfo/110-03",
    text: "Developmental and Educational Psychology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/110-04",
    text: "Social Psychology, Industrial and Organisational Psychology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/110-05",
    text: "Differential, Clinical and Medical Psychology, Methodology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/111-01",
    text: "Sociological Theory",
  },
  {
    value: "https://github.com/tibonto/dfgfo/111-02",
    text: "Empirical Social Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/111-03",
    text: "Communication Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/111-04",
    text: "Political Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/112-01",
    text: "Economic Theory",
  },
  {
    value: "https://github.com/tibonto/dfgfo/112-02",
    text: "Economic Policy, Applied Economics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/112-03",
    text: "Business Administration",
  },
  {
    value: "https://github.com/tibonto/dfgfo/112-04",
    text: "Statistics and Econometrics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/112-05",
    text: "Economic and Social History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/113-01",
    text: "Principles of Law and Jurisprudence",
  },
  {
    value: "https://github.com/tibonto/dfgfo/113-02",
    text: "Private Law",
  },
  {
    value: "https://github.com/tibonto/dfgfo/113-03",
    text: "Public Law",
  },
  {
    value: "https://github.com/tibonto/dfgfo/113-04",
    text: "Criminal Law",
  },
  {
    value: "https://github.com/tibonto/dfgfo/113-05",
    text: "Criminology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-01",
    text: "Biochemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-02",
    text: "Biophysics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-03",
    text: "Cell Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-04",
    text: "Structural Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-05",
    text: "General Genetics and Functional Genome Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-06",
    text: "Developmental Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201-07",
    text: "Bioinformatics and Theoretical Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-01",
    text: "Evolution and Systematics of Plants and Fungi",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-02",
    text: "Ecology and Biodiversity of Plants and Ecosystems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-03",
    text: "Organismic Interactions, Chemical Ecology and Microbiomes of Plant Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-04",
    text: "Plant Physiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-05",
    text: "Plant Biochemistry and Biophysics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-06",
    text: "Plant Cell and Developmental Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202-07",
    text: "Plant Genetics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203-01",
    text: "Systematics and Morphology (Zoology)",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203-02",
    text: "Evolution, Anthropology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203-03",
    text: "Ecology and Biodiversity of Animals and Ecosystems, Organismic Interactions",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203-04",
    text: "Sensory and Behavioural Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203-05",
    text: "Animal Physiology and Biochemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203-06",
    text: "Evolutionary Cell and Developmental Biology (Zoology)",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204-01",
    text: "Metabolism, Biochemistry and Genetics of Microorganisms",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204-02",
    text: "Microbial Ecology and Applied Microbiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204-03",
    text: "Medical Microbiology and Mycology, Hygiene, Molecular Infection Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204-04",
    text: "Virology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204-05",
    text: "Immunology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204-06",
    text: "Parasitology and Biology of Tropical Infectious Disease Pathogens",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-01",
    text: "Epidemiology and Medical Biometry/Statistics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-02",
    text: "Public Health, Health Services Research, Social Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-03",
    text: "Human Genetics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-04",
    text: "Physiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-05",
    text: "Nutritional Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-06",
    text: "Pathology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-07",
    text: "Medical Informatics and Medical Bioinformatics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-08",
    text: "Pharmacy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-09",
    text: "Pharmacology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-10",
    text: "Toxicology, Occupational Medicine, Clinical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-11",
    text: "Anaesthesiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-12",
    text: "Cardiology, Angiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-13",
    text: "Pneumology, Thoracic Surgery",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-14",
    text: "Hematology, Oncology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-15",
    text: "Gastroenterology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-16",
    text: "Nephrology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-17",
    text: "Endocrinology, Diabetology, Metabolism",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-18",
    text: "Rheumatology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-19",
    text: "Dermatology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-20",
    text: "Pediatric and Adolescent Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-21",
    text: "Gynaecology and Obstetrics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-22",
    text: "Clinical Immunology and Allergology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-23",
    text: "Reproductive Medicine, Urology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-24",
    text: "Biogerontology and Geriatric Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-25",
    text: "General and Visceral Surgery",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-26",
    text: "Cardiac and Vascular Sugery",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-27",
    text: "Orthopaedics, Traumatology, Reconstructive Surgery",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-28",
    text: "Dentistry, Oral Surgery",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-29",
    text: "Otolaryngology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-30",
    text: "Radiology, Nuclear Medicine, Radiotherapy, Radiobiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-31",
    text: "Clinical Infectiology and Tropical Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-32",
    text: "Medical Physics, Biomedical Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205-33",
    text: "Anatomy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-01",
    text: "Developmental Neurobiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-02",
    text: "Molecular Biology and Physiology of Neurons and Glial Cells",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-03",
    text: "Experimental and Theoretical Network Neuroscience",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-04",
    text: "Cognitive, Systems and Behavioural Neurobiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-05",
    text: "Experimental Models for the Understanding of Nervous System Diseases",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-06",
    text: "Molecular and Cellular Neurology and Neuropathology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-07",
    text: "Clinical Neurosciences; Neurosurgery and Neuroradiology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-08",
    text: "Human Cognitive and Systems Neuroscience",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-09",
    text: "Biological Psychiatry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-10",
    text: "Clinical Psychiatry, Psychotherapy, Child and Adolescent Psychiatry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206-11",
    text: "Ophthalmology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-01",
    text: "Soil Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-02",
    text: "Plant Breeding and Plant Pathology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-03",
    text: "Plant Cultivation, Plant Nutrition, Agricultural Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-04",
    text: "Ecology of Land Use",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-05",
    text: "Agricultural Economics, Agricultural Policy, Agricultural Sociology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-06",
    text: "Forestry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-07",
    text: "Animal Breeding, Animal Nutrition, Animal Husbandry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207-08",
    text: "Veterinary Medical Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/307-01",
    text: "Experimental Condensed Matter Physics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/307-02",
    text: "Theoretical Condensed Matter Physics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/308-01",
    text: "Optics, Quantum Optics, Atoms, Molecules, Plasmas",
  },
  {
    value: "https://github.com/tibonto/dfgfo/309-01",
    text: "Nuclear and Elementary Particle Physics, Quantum Mechanics, Relativity, Fields",
  },
  {
    value: "https://github.com/tibonto/dfgfo/310-01",
    text: "Statistical Physics, Soft Matter, Biological Physics, Nonlinear Dynamics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/311-01",
    text: "Astrophysics and Astronomy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/312-01",
    text: "Mathematics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/313-01",
    text: "Atmospheric Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/313-02",
    text: "Oceanography",
  },
  {
    value: "https://github.com/tibonto/dfgfo/314-01",
    text: "Geology and Palaeontology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/315-01",
    text: "Geophysics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/315-02",
    text: "Geodesy, Photogrammetry, Remote Sensing, Geoinformatics, Cartography",
  },
  {
    value: "https://github.com/tibonto/dfgfo/316-01",
    text: "Mineralogy, Petrology and Geochemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/317-01",
    text: "Physical Geography",
  },
  {
    value: "https://github.com/tibonto/dfgfo/317-02",
    text: "Human Geography",
  },
  {
    value: "https://github.com/tibonto/dfgfo/318-01",
    text: "Hydrogeology, Hydrology, Limnology, Urban Water Management, Water Chemistry, Integrated Water Resources Management",
  },
  {
    value: "https://github.com/tibonto/dfgfo/321-01",
    text: "Inorganic Molecular Chemistry - Synthesis and Characterisation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/321-02",
    text: "Organic Molecular Chemistry - Synthesis and Characterisation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/322-01",
    text: "Solid State and Surface Chemistry, Material Synthesis",
  },
  {
    value: "https://github.com/tibonto/dfgfo/322-02",
    text: "Physical Chemistry of Solids and Surfaces, Material Characterisation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/323-01",
    text: "Physical Chemistry of Molecules, Liquids and Interfaces, Biophysical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/324-01",
    text: "Analytical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/325-01",
    text: "Biological and Biomimetic Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/325-02",
    text: "Food Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/326-01",
    text: "Preparatory and Physical Chemistry of Polymers",
  },
  {
    value: "https://github.com/tibonto/dfgfo/326-02",
    text: "Experimental and Theoretical Physics of Polymers",
  },
  {
    value: "https://github.com/tibonto/dfgfo/326-03",
    text: "Polymer Materials",
  },
  {
    value: "https://github.com/tibonto/dfgfo/327-01",
    text: "Electron Structure, Dynamics, Simulation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/327-02",
    text: "Molecules, Materials, Surfaces",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401-01",
    text: "Metal-Cutting and Abrasive Manufacturing Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401-02",
    text: "Primary Shaping and Reshaping Technology, Additive Manufacturing",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401-03",
    text: "Joining and Separation Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401-04",
    text: "Plastics Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401-05",
    text: "Production Systems, Operations Management, Quality Management and Factory Planning",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401-06",
    text: "Production Automation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/402-01",
    text: "Engineering Design, Machine Elements, Product Development",
  },
  {
    value: "https://github.com/tibonto/dfgfo/402-02",
    text: "Mechanics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/402-03",
    text: "Lightweight Construction, Textile Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/402-04",
    text: "Acoustics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/403-01",
    text: "Chemical and Thermal Process Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/403-02",
    text: "Technical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/403-03",
    text: "Mechanical Process Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/403-04",
    text: "Biological Process Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/404-01",
    text: "Energy Process Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/404-02",
    text: "Technical Thermodynamics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/404-03",
    text: "Fluid Mechanics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/404-04",
    text: "Hydraulic and Turbo Engines and Piston Engines",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405-01",
    text: "Metallurgical, Thermal and Thermomechanical Treatment of Materials",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405-02",
    text: "Materials in Sintering Processes and Generative Manufacturing Processes",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405-03",
    text: "Coating and Surface Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405-04",
    text: "Mechanical Properties of Metallic Materials and their Microstructural Origins",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405-05",
    text: "Glass, Ceramics and Derived Composites",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405-06",
    text: "Polymeric and Biogenic Materials and Derived Composites",
  },
  {
    value: "https://github.com/tibonto/dfgfo/406-01",
    text: "Synthesis and Properties of Functional Materials",
  },
  {
    value: "https://github.com/tibonto/dfgfo/406-02",
    text: "Biomaterials",
  },
  {
    value: "https://github.com/tibonto/dfgfo/406-03",
    text: "Thermodynamics and Kinetics as well as Properties of Phases and Microstructure of Materials",
  },
  {
    value: "https://github.com/tibonto/dfgfo/406-04",
    text: "Computer-Aided Design of Materials and Simulation of Materials Behaviour from Atomic to Microscopic Scale",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407-01",
    text: "Automation, Control Systems, Robotics, Mechatronics, Cyber Physical Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407-02",
    text: "Measurement Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407-03",
    text: "Microsystems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407-04",
    text: "Traffic and Transport Systems, Logistics, Intelligent and Automated Traffic",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407-05",
    text: "Human Factors, Ergonomics, Human-Machine Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407-06",
    text: "Biomedical Systems Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/408-01",
    text: "Electronic Semiconductors, Components, Circuits, Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/408-02",
    text: "Communications, High-Frequency and Network Technology, Theoretical Electrical Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/408-03",
    text: "Electrical Energy Generation, Distribution, Application",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-01",
    text: "Theoretical Computer Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-02",
    text: "Software Engineering and Programming Languages",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-03",
    text: "Security and Dependability",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-04",
    text: "Operating, Communication, Database and Distributed Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-05",
    text: "Interactive and Intelligent Systems, Image and Language Processing, Computer Graphics and Visualisation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-06",
    text: "Information Systems, Process and Knowledge Management",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-07",
    text: "Computer Architecture and Embedded Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409-08",
    text: "Massively Parallel and Data-Intensive Systems",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410-01",
    text: "Architecture, Building and Construction History, Construction Research, Sustainable Building Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410-02",
    text: "Urbanism, Spatial Planning, Transportation and Infrastructure Planning, Landscape Planning",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410-03",
    text: "Construction Material Sciences, Chemistry, Building Physics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410-04",
    text: "Structural Engineering, Building Informatics and Construction Operation",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410-05",
    text: "Applied Mechanics, Statics and Dynamics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410-06",
    text: "Geotechnics, Hydraulic Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/23",
    text: "Agriculture, Forestry and Veterinary Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/308",
    text: "Optics, Quantum Optics and Physics of Atoms, Molecules and Plasmas",
  },
  {
    value: "https://github.com/tibonto/dfgfo/309",
    text: "Particles, Nuclei and Fields",
  },
  {
    value: "https://github.com/tibonto/dfgfo/310",
    text: "Statistical Physics, Soft Matter, Biological Physics, Nonlinear Dynamics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/311",
    text: "Astrophysics and Astronomy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/312",
    text: "Mathematics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/314",
    text: "Geology and Palaeontology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/316",
    text: "Mineralogy, Petrology and Geochemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/318",
    text: "Water Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/323",
    text: "Physical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/324",
    text: "Analytical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/33",
    text: "Mathematics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/45",
    text: "Construction Engineering and Architecture",
  },
  {
    value: "https://github.com/tibonto/dfgfo/1",
    text: "Humanities and Social Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/107",
    text: "Theology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/307",
    text: "Condensed Matter Physics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/313",
    text: "Atmospheric Science, Oceanography and Climate Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/315",
    text: "Geophysics and Geodesy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/317",
    text: "Geography",
  },
  {
    value: "https://github.com/tibonto/dfgfo/321",
    text: "Molecular Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/322",
    text: "Chemical Solid State and Surface Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/325",
    text: "Biological Chemistry and Food Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/327",
    text: "Theoretical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/41",
    text: "Mechanical and Industrial Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/42",
    text: "Thermal Engineering/ Process Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/43",
    text: "Materials Science and Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/103",
    text: "Art History, Music, Theatre and Media Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/108",
    text: "Philosophy",
  },
  {
    value: "https://github.com/tibonto/dfgfo/2",
    text: "Life Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/21",
    text: "Biology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/22",
    text: "Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/326",
    text: "Polymer Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/408",
    text: "Electrical Engineering and Information Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/44",
    text: "Computer Science, Systems and  Electrical Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/102",
    text: "History",
  },
  {
    value: "https://github.com/tibonto/dfgfo/104",
    text: "Linguistics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/105",
    text: "Literary Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/109",
    text: "Educational Research",
  },
  {
    value: "https://github.com/tibonto/dfgfo/111",
    text: "Social Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/3",
    text: "Natural Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/402",
    text: "Mechanics and Constructive Mechanical Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/403",
    text: "Process Engineering, Technical Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/404",
    text: "Fluid Mechanics, Technical Thermodynamics and Thermal Energy Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/406",
    text: "Materials Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/101",
    text: "Ancient Cultures",
  },
  {
    value: "https://github.com/tibonto/dfgfo/106",
    text: "Social and Cultural Anthropology, Non-European Cultures, Jewish Studies and Religious Studies",
  },
  {
    value: "https://github.com/tibonto/dfgfo/110",
    text: "Psychology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/112",
    text: "Economics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/113",
    text: "Jurisprudence",
  },
  {
    value: "https://github.com/tibonto/dfgfo/12",
    text: "Social and Behavioural Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/32",
    text: "Physics",
  },
  {
    value: "https://github.com/tibonto/dfgfo/4",
    text: "Engineering Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/203",
    text: "Zoology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/204",
    text: "Microbiology, Virology and Immunology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/34",
    text: "Geosciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/401",
    text: "Production Technology",
  },
  {
    value: "https://github.com/tibonto/dfgfo/405",
    text: "Materials Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/407",
    text: "Systems Engineering",
  },
  {
    value: "https://github.com/tibonto/dfgfo/410",
    text: "Construction Engineering and Architecture",
  },
  {
    value: "https://github.com/tibonto/dfgfo/201",
    text: "Basic Research in Biology and Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/202",
    text: "Plant Sciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/31",
    text: "Chemistry",
  },
  {
    value: "https://github.com/tibonto/dfgfo/11",
    text: "Humanities",
  },
  {
    value: "https://github.com/tibonto/dfgfo/207",
    text: "Agriculture, Forestry and Veterinary Medicine",
  },
  {
    value: "https://github.com/tibonto/dfgfo/409",
    text: "Computer Science",
  },
  {
    value: "https://github.com/tibonto/dfgfo/206",
    text: "Neurosciences",
  },
  {
    value: "https://github.com/tibonto/dfgfo/205",
    text: "Medicine",
  },
].sort((a, b) => a.text.localeCompare(b.text));

export const licenses = [
  {
    value: "http://spdx.org/licenses/0BSD",
    text: "BSD Zero Clause License",
  },
  {
    value: "http://spdx.org/licenses/AAL",
    text: "Attribution Assurance License",
  },
  {
    value: "http://spdx.org/licenses/Abstyles",
    text: "Abstyles License",
  },
  {
    value: "http://spdx.org/licenses/AdaCore-doc",
    text: "AdaCore Doc License",
  },
  {
    value: "http://spdx.org/licenses/Adobe-2006",
    text: "Adobe Systems Incorporated Source Code License Agreement",
  },
  {
    value: "http://spdx.org/licenses/Adobe-Glyph",
    text: "Adobe Glyph List License",
  },
  {
    value: "http://spdx.org/licenses/Adobe-Utopia",
    text: "Adobe Utopia Font License",
  },
  {
    value: "http://spdx.org/licenses/ADSL",
    text: "Amazon Digital Services License",
  },
  {
    value: "http://spdx.org/licenses/AFL-1.1",
    text: "Academic Free License v1.1",
  },
  {
    value: "http://spdx.org/licenses/AFL-1.2",
    text: "Academic Free License v1.2",
  },
  {
    value: "http://spdx.org/licenses/AFL-2.0",
    text: "Academic Free License v2.0",
  },
  {
    value: "http://spdx.org/licenses/AFL-2.1",
    text: "Academic Free License v2.1",
  },
  {
    value: "http://spdx.org/licenses/AFL-3.0",
    text: "Academic Free License v3.0",
  },
  {
    value: "http://spdx.org/licenses/Afmparse",
    text: "Afmparse License",
  },
  {
    value: "http://spdx.org/licenses/AGPL-1.0-only",
    text: "Affero General Public License v1.0 only",
  },
  {
    value: "http://spdx.org/licenses/AGPL-1.0-or-later",
    text: "Affero General Public License v1.0 or later",
  },
  {
    value: "http://spdx.org/licenses/AGPL-3.0-only",
    text: "GNU Affero General Public License v3.0 only",
  },
  {
    value: "http://spdx.org/licenses/AGPL-3.0-or-later",
    text: "GNU Affero General Public License v3.0 or later",
  },
  {
    value: "http://spdx.org/licenses/Aladdin",
    text: "Aladdin Free Public License",
  },
  {
    value: "http://spdx.org/licenses/AMDPLPA",
    text: "AMD's plpa_map.c License",
  },
  {
    value: "http://spdx.org/licenses/AML",
    text: "Apple MIT License",
  },
  {
    value: "http://spdx.org/licenses/AMPAS",
    text: "Academy of Motion Picture Arts and Sciences BSD",
  },
  {
    value: "http://spdx.org/licenses/ANTLR-PD",
    text: "ANTLR Software Rights Notice",
  },
  {
    value: "http://spdx.org/licenses/ANTLR-PD-fallback",
    text: "ANTLR Software Rights Notice with license fallback",
  },
  {
    value: "http://spdx.org/licenses/Apache-1.0",
    text: "Apache License 1.0",
  },
  {
    value: "http://spdx.org/licenses/Apache-1.1",
    text: "Apache License 1.1",
  },
  {
    value: "http://spdx.org/licenses/Apache-2.0",
    text: "Apache License 2.0",
  },
  {
    value: "http://spdx.org/licenses/APAFML",
    text: "Adobe Postscript AFM License",
  },
  {
    value: "http://spdx.org/licenses/APL-1.0",
    text: "Adaptive Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/App-s2p",
    text: "App::s2p License",
  },
  {
    value: "http://spdx.org/licenses/APSL-1.0",
    text: "Apple Public Source License 1.0",
  },
  {
    value: "http://spdx.org/licenses/APSL-1.1",
    text: "Apple Public Source License 1.1",
  },
  {
    value: "http://spdx.org/licenses/APSL-1.2",
    text: "Apple Public Source License 1.2",
  },
  {
    value: "http://spdx.org/licenses/APSL-2.0",
    text: "Apple Public Source License 2.0",
  },
  {
    value: "http://spdx.org/licenses/Arphic-1999",
    text: "Arphic Public License",
  },
  {
    value: "http://spdx.org/licenses/Artistic-1.0",
    text: "Artistic License 1.0",
  },
  {
    value: "http://spdx.org/licenses/Artistic-1.0-cl8",
    text: "Artistic License 1.0 w/clause 8",
  },
  {
    value: "http://spdx.org/licenses/Artistic-1.0-Perl",
    text: "Artistic License 1.0 (Perl)",
  },
  {
    value: "http://spdx.org/licenses/Artistic-2.0",
    text: "Artistic License 2.0",
  },
  {
    value: "http://spdx.org/licenses/ASWF-Digital-Assets-1.0",
    text: "ASWF Digital Assets License version 1.0",
  },
  {
    value: "http://spdx.org/licenses/ASWF-Digital-Assets-1.1",
    text: "ASWF Digital Assets License 1.1",
  },
  {
    value: "http://spdx.org/licenses/Baekmuk",
    text: "Baekmuk License",
  },
  {
    value: "http://spdx.org/licenses/Bahyph",
    text: "Bahyph License",
  },
  {
    value: "http://spdx.org/licenses/Barr",
    text: "Barr License",
  },
  {
    value: "http://spdx.org/licenses/Beerware",
    text: "Beerware License",
  },
  {
    value: "http://spdx.org/licenses/Bitstream-Charter",
    text: "Bitstream Charter Font License",
  },
  {
    value: "http://spdx.org/licenses/Bitstream-Vera",
    text: "Bitstream Vera Font License",
  },
  {
    value: "http://spdx.org/licenses/BitTorrent-1.0",
    text: "BitTorrent Open Source License v1.0",
  },
  {
    value: "http://spdx.org/licenses/BitTorrent-1.1",
    text: "BitTorrent Open Source License v1.1",
  },
  {
    value: "http://spdx.org/licenses/blessing",
    text: "SQLite Blessing",
  },
  {
    value: "http://spdx.org/licenses/BlueOak-1.0.0",
    text: "Blue Oak Model License 1.0.0",
  },
  {
    value: "http://spdx.org/licenses/Boehm-GC",
    text: "Boehm-Demers-Weiser GC License",
  },
  {
    value: "http://spdx.org/licenses/Borceux",
    text: "Borceux license",
  },
  {
    value: "http://spdx.org/licenses/Brian-Gladman-3-Clause",
    text: "Brian Gladman 3-Clause License",
  },
  {
    value: "http://spdx.org/licenses/BSD-1-Clause",
    text: "BSD 1-Clause License",
  },
  {
    value: "http://spdx.org/licenses/BSD-2-Clause",
    text: 'BSD 2-Clause "Simplified" License',
  },
  {
    value: "http://spdx.org/licenses/BSD-2-Clause-Patent",
    text: "BSD-2-Clause Plus Patent License",
  },
  {
    value: "http://spdx.org/licenses/BSD-2-Clause-Views",
    text: "BSD 2-Clause with views sentence",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause",
    text: 'BSD 3-Clause "New" or "Revised" License',
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-Attribution",
    text: "BSD with attribution",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-Clear",
    text: "BSD 3-Clause Clear License",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-flex",
    text: "BSD 3-Clause Flex variant",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-HP",
    text: "Hewlett-Packard BSD variant license",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-LBNL",
    text: "Lawrence Berkeley National Labs BSD variant license",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-Modification",
    text: "BSD 3-Clause Modification",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-No-Military-License",
    text: "BSD 3-Clause No Military License",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-No-Nuclear-License",
    text: "BSD 3-Clause No Nuclear License",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-No-Nuclear-License-2014",
    text: "BSD 3-Clause No Nuclear License 2014",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-No-Nuclear-Warranty",
    text: "BSD 3-Clause No Nuclear Warranty",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-Open-MPI",
    text: "BSD 3-Clause Open MPI variant",
  },
  {
    value: "http://spdx.org/licenses/BSD-3-Clause-Sun",
    text: "BSD 3-Clause Sun Microsystems",
  },
  {
    value: "http://spdx.org/licenses/BSD-4-Clause",
    text: 'BSD 4-Clause "Original" or "Old" License',
  },
  {
    value: "http://spdx.org/licenses/BSD-4-Clause-Shortened",
    text: "BSD 4 Clause Shortened",
  },
  {
    value: "http://spdx.org/licenses/BSD-4-Clause-UC",
    text: "BSD-4-Clause (University of California-Specific)",
  },
  {
    value: "http://spdx.org/licenses/BSD-4.3RENO",
    text: "BSD 4.3 RENO License",
  },
  {
    value: "http://spdx.org/licenses/BSD-4.3TAHOE",
    text: "BSD 4.3 TAHOE License",
  },
  {
    value: "http://spdx.org/licenses/BSD-Advertising-Acknowledgement",
    text: "BSD Advertising Acknowledgement License",
  },
  {
    value: "http://spdx.org/licenses/BSD-Attribution-HPND-disclaimer",
    text: "BSD with Attribution and HPND disclaimer",
  },
  {
    value: "http://spdx.org/licenses/BSD-Inferno-Nettverk",
    text: "BSD-Inferno-Nettverk",
  },
  {
    value: "http://spdx.org/licenses/BSD-Protection",
    text: "BSD Protection License",
  },
  {
    value: "http://spdx.org/licenses/BSD-Source-Code",
    text: "BSD Source Code Attribution",
  },
  {
    value: "http://spdx.org/licenses/BSD-Systemics",
    text: "Systemics BSD variant license",
  },
  {
    value: "http://spdx.org/licenses/BSL-1.0",
    text: "Boost Software License 1.0",
  },
  {
    value: "http://spdx.org/licenses/BUSL-1.1",
    text: "Business Source License 1.1",
  },
  {
    value: "http://spdx.org/licenses/bzip2-1.0.6",
    text: "bzip2 and libbzip2 License v1.0.6",
  },
  {
    value: "http://spdx.org/licenses/C-UDA-1.0",
    text: "Computational Use of Data Agreement v1.0",
  },
  {
    value: "http://spdx.org/licenses/CAL-1.0",
    text: "Cryptographic Autonomy License 1.0",
  },
  {
    value: "http://spdx.org/licenses/CAL-1.0-Combined-Work-Exception",
    text: "Cryptographic Autonomy License 1.0 (Combined Work Exception)",
  },
  {
    value: "http://spdx.org/licenses/Caldera",
    text: "Caldera License",
  },
  {
    value: "http://spdx.org/licenses/CATOSL-1.1",
    text: "Computer Associates Trusted Open Source License 1.1",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-1.0",
    text: "Creative Commons Attribution 1.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-2.0",
    text: "Creative Commons Attribution 2.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-2.5",
    text: "Creative Commons Attribution 2.5 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-2.5-AU",
    text: "Creative Commons Attribution 2.5 Australia",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-3.0",
    text: "Creative Commons Attribution 3.0 Unported",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-3.0-AT",
    text: "Creative Commons Attribution 3.0 Austria",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-3.0-DE",
    text: "Creative Commons Attribution 3.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-3.0-IGO",
    text: "Creative Commons Attribution 3.0 IGO",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-3.0-NL",
    text: "Creative Commons Attribution 3.0 Netherlands",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-3.0-US",
    text: "Creative Commons Attribution 3.0 United States",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-4.0",
    text: "Creative Commons Attribution 4.0 International",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-1.0",
    text: "Creative Commons Attribution Non Commercial 1.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-2.0",
    text: "Creative Commons Attribution Non Commercial 2.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-2.5",
    text: "Creative Commons Attribution Non Commercial 2.5 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-3.0",
    text: "Creative Commons Attribution Non Commercial 3.0 Unported",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-3.0-DE",
    text: "Creative Commons Attribution Non Commercial 3.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-4.0",
    text: "Creative Commons Attribution Non Commercial 4.0 International",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-1.0",
    text: "Creative Commons Attribution Non Commercial No Derivatives 1.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-2.0",
    text: "Creative Commons Attribution Non Commercial No Derivatives 2.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-2.5",
    text: "Creative Commons Attribution Non Commercial No Derivatives 2.5 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-3.0",
    text: "Creative Commons Attribution Non Commercial No Derivatives 3.0 Unported",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-3.0-DE",
    text: "Creative Commons Attribution Non Commercial No Derivatives 3.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-3.0-IGO",
    text: "Creative Commons Attribution Non Commercial No Derivatives 3.0 IGO",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-ND-4.0",
    text: "Creative Commons Attribution Non Commercial No Derivatives 4.0 International",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-1.0",
    text: "Creative Commons Attribution Non Commercial Share Alike 1.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-2.0",
    text: "Creative Commons Attribution Non Commercial Share Alike 2.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-2.0-DE",
    text: "Creative Commons Attribution Non Commercial Share Alike 2.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-2.0-FR",
    text: "Creative Commons Attribution-NonCommercial-ShareAlike 2.0 France",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-2.0-UK",
    text: "Creative Commons Attribution Non Commercial Share Alike 2.0 England and Wales",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-2.5",
    text: "Creative Commons Attribution Non Commercial Share Alike 2.5 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-3.0",
    text: "Creative Commons Attribution Non Commercial Share Alike 3.0 Unported",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-3.0-DE",
    text: "Creative Commons Attribution Non Commercial Share Alike 3.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-3.0-IGO",
    text: "Creative Commons Attribution Non Commercial Share Alike 3.0 IGO",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-NC-SA-4.0",
    text: "Creative Commons Attribution Non Commercial Share Alike 4.0 International",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-ND-1.0",
    text: "Creative Commons Attribution No Derivatives 1.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-ND-2.0",
    text: "Creative Commons Attribution No Derivatives 2.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-ND-2.5",
    text: "Creative Commons Attribution No Derivatives 2.5 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-ND-3.0",
    text: "Creative Commons Attribution No Derivatives 3.0 Unported",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-ND-3.0-DE",
    text: "Creative Commons Attribution No Derivatives 3.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-ND-4.0",
    text: "Creative Commons Attribution No Derivatives 4.0 International",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-1.0",
    text: "Creative Commons Attribution Share Alike 1.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-2.0",
    text: "Creative Commons Attribution Share Alike 2.0 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-2.0-UK",
    text: "Creative Commons Attribution Share Alike 2.0 England and Wales",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-2.1-JP",
    text: "Creative Commons Attribution Share Alike 2.1 Japan",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-2.5",
    text: "Creative Commons Attribution Share Alike 2.5 Generic",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-3.0",
    text: "Creative Commons Attribution Share Alike 3.0 Unported",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-3.0-AT",
    text: "Creative Commons Attribution Share Alike 3.0 Austria",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-3.0-DE",
    text: "Creative Commons Attribution Share Alike 3.0 Germany",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-3.0-IGO",
    text: "Creative Commons Attribution-ShareAlike 3.0 IGO",
  },
  {
    value: "http://spdx.org/licenses/CC-BY-SA-4.0",
    text: "Creative Commons Attribution Share Alike 4.0 International",
  },
  {
    value: "http://spdx.org/licenses/CC-PDDC",
    text: "Creative Commons Public Domain Dedication and Certification",
  },
  {
    value: "http://spdx.org/licenses/CC0-1.0",
    text: "Creative Commons Zero v1.0 Universal",
  },
  {
    value: "http://spdx.org/licenses/CDDL-1.0",
    text: "Common Development and Distribution License 1.0",
  },
  {
    value: "http://spdx.org/licenses/CDDL-1.1",
    text: "Common Development and Distribution License 1.1",
  },
  {
    value: "http://spdx.org/licenses/CDL-1.0",
    text: "Common Documentation License 1.0",
  },
  {
    value: "http://spdx.org/licenses/CDLA-Permissive-1.0",
    text: "Community Data License Agreement Permissive 1.0",
  },
  {
    value: "http://spdx.org/licenses/CDLA-Permissive-2.0",
    text: "Community Data License Agreement Permissive 2.0",
  },
  {
    value: "http://spdx.org/licenses/CDLA-Sharing-1.0",
    text: "Community Data License Agreement Sharing 1.0",
  },
  {
    value: "http://spdx.org/licenses/CECILL-1.0",
    text: "CeCILL Free Software License Agreement v1.0",
  },
  {
    value: "http://spdx.org/licenses/CECILL-1.1",
    text: "CeCILL Free Software License Agreement v1.1",
  },
  {
    value: "http://spdx.org/licenses/CECILL-2.0",
    text: "CeCILL Free Software License Agreement v2.0",
  },
  {
    value: "http://spdx.org/licenses/CECILL-2.1",
    text: "CeCILL Free Software License Agreement v2.1",
  },
  {
    value: "http://spdx.org/licenses/CECILL-B",
    text: "CeCILL-B Free Software License Agreement",
  },
  {
    value: "http://spdx.org/licenses/CECILL-C",
    text: "CeCILL-C Free Software License Agreement",
  },
  {
    value: "http://spdx.org/licenses/CERN-OHL-1.1",
    text: "CERN Open Hardware Licence v1.1",
  },
  {
    value: "http://spdx.org/licenses/CERN-OHL-1.2",
    text: "CERN Open Hardware Licence v1.2",
  },
  {
    value: "http://spdx.org/licenses/CERN-OHL-P-2.0",
    text: "CERN Open Hardware Licence Version 2 - Permissive",
  },
  {
    value: "http://spdx.org/licenses/CERN-OHL-S-2.0",
    text: "CERN Open Hardware Licence Version 2 - Strongly Reciprocal",
  },
  {
    value: "http://spdx.org/licenses/CERN-OHL-W-2.0",
    text: "CERN Open Hardware Licence Version 2 - Weakly Reciprocal",
  },
  {
    value: "http://spdx.org/licenses/CFITSIO",
    text: "CFITSIO License",
  },
  {
    value: "http://spdx.org/licenses/check-cvs",
    text: "check-cvs License",
  },
  {
    value: "http://spdx.org/licenses/checkmk",
    text: "Checkmk License",
  },
  {
    value: "http://spdx.org/licenses/ClArtistic",
    text: "Clarified Artistic License",
  },
  {
    value: "http://spdx.org/licenses/Clips",
    text: "Clips License",
  },
  {
    value: "http://spdx.org/licenses/CMU-Mach",
    text: "CMU Mach License",
  },
  {
    value: "http://spdx.org/licenses/CNRI-Jython",
    text: "CNRI Jython License",
  },
  {
    value: "http://spdx.org/licenses/CNRI-Python",
    text: "CNRI Python License",
  },
  {
    value: "http://spdx.org/licenses/CNRI-Python-GPL-Compatible",
    text: "CNRI Python Open Source GPL Compatible License Agreement",
  },
  {
    value: "http://spdx.org/licenses/COIL-1.0",
    text: "Copyfree Open Innovation License",
  },
  {
    value: "http://spdx.org/licenses/Community-Spec-1.0",
    text: "Community Specification License 1.0",
  },
  {
    value: "http://spdx.org/licenses/Condor-1.1",
    text: "Condor Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/copyleft-next-0.3.0",
    text: "copyleft-next 0.3.0",
  },
  {
    value: "http://spdx.org/licenses/copyleft-next-0.3.1",
    text: "copyleft-next 0.3.1",
  },
  {
    value: "http://spdx.org/licenses/Cornell-Lossless-JPEG",
    text: "Cornell Lossless JPEG License",
  },
  {
    value: "http://spdx.org/licenses/CPAL-1.0",
    text: "Common Public Attribution License 1.0",
  },
  {
    value: "http://spdx.org/licenses/CPL-1.0",
    text: "Common Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/CPOL-1.02",
    text: "Code Project Open License 1.02",
  },
  {
    value: "http://spdx.org/licenses/Cronyx",
    text: "Cronyx License",
  },
  {
    value: "http://spdx.org/licenses/Crossword",
    text: "Crossword License",
  },
  {
    value: "http://spdx.org/licenses/CrystalStacker",
    text: "CrystalStacker License",
  },
  {
    value: "http://spdx.org/licenses/CUA-OPL-1.0",
    text: "CUA Office Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/Cube",
    text: "Cube License",
  },
  {
    value: "http://spdx.org/licenses/curl",
    text: "curl License",
  },
  {
    value: "http://spdx.org/licenses/D-FSL-1.0",
    text: "Deutsche Freie Software Lizenz",
  },
  {
    value: "http://spdx.org/licenses/diffmark",
    text: "diffmark license",
  },
  {
    value: "http://spdx.org/licenses/DL-DE-BY-2.0",
    text: "Data licence Germany \\u2013 attribution \\u2013 version 2.0",
  },
  {
    value: "http://spdx.org/licenses/DL-DE-ZERO-2.0",
    text: "Data licence Germany \\u2013 zero \\u2013 version 2.0",
  },
  {
    value: "http://spdx.org/licenses/DOC",
    text: "DOC License",
  },
  {
    value: "http://spdx.org/licenses/Dotseqn",
    text: "Dotseqn License",
  },
  {
    value: "http://spdx.org/licenses/DRL-1.0",
    text: "Detection Rule License 1.0",
  },
  {
    value: "http://spdx.org/licenses/DSDP",
    text: "DSDP License",
  },
  {
    value: "http://spdx.org/licenses/dtoa",
    text: "David M. Gay dtoa License",
  },
  {
    value: "http://spdx.org/licenses/dvipdfm",
    text: "dvipdfm License",
  },
  {
    value: "http://spdx.org/licenses/ECL-1.0",
    text: "Educational Community License v1.0",
  },
  {
    value: "http://spdx.org/licenses/ECL-2.0",
    text: "Educational Community License v2.0",
  },
  {
    value: "http://spdx.org/licenses/EFL-1.0",
    text: "Eiffel Forum License v1.0",
  },
  {
    value: "http://spdx.org/licenses/EFL-2.0",
    text: "Eiffel Forum License v2.0",
  },
  {
    value: "http://spdx.org/licenses/eGenix",
    text: "eGenix.com Public License 1.1.0",
  },
  {
    value: "http://spdx.org/licenses/Elastic-2.0",
    text: "Elastic License 2.0",
  },
  {
    value: "http://spdx.org/licenses/Entessa",
    text: "Entessa Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/EPICS",
    text: "EPICS Open License",
  },
  {
    value: "http://spdx.org/licenses/EPL-1.0",
    text: "Eclipse Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/EPL-2.0",
    text: "Eclipse Public License 2.0",
  },
  {
    value: "http://spdx.org/licenses/ErlPL-1.1",
    text: "Erlang Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/etalab-2.0",
    text: "Etalab Open License 2.0",
  },
  {
    value: "http://spdx.org/licenses/EUDatagrid",
    text: "EU DataGrid Software License",
  },
  {
    value: "http://spdx.org/licenses/EUPL-1.0",
    text: "European Union Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/EUPL-1.1",
    text: "European Union Public License 1.1",
  },
  {
    value: "http://spdx.org/licenses/EUPL-1.2",
    text: "European Union Public License 1.2",
  },
  {
    value: "http://spdx.org/licenses/Eurosym",
    text: "Eurosym License",
  },
  {
    value: "http://spdx.org/licenses/Fair",
    text: "Fair License",
  },
  {
    value: "http://spdx.org/licenses/FBM",
    text: "Fuzzy Bitmap License",
  },
  {
    value: "http://spdx.org/licenses/FDK-AAC",
    text: "Fraunhofer FDK AAC Codec Library",
  },
  {
    value: "http://spdx.org/licenses/Ferguson-Twofish",
    text: "Ferguson Twofish License",
  },
  {
    value: "http://spdx.org/licenses/Frameworx-1.0",
    text: "Frameworx Open License 1.0",
  },
  {
    value: "http://spdx.org/licenses/FreeBSD-DOC",
    text: "FreeBSD Documentation License",
  },
  {
    value: "http://spdx.org/licenses/FreeImage",
    text: "FreeImage Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/FSFAP",
    text: "FSF All Permissive License",
  },
  {
    value: "http://spdx.org/licenses/FSFUL",
    text: "FSF Unlimited License",
  },
  {
    value: "http://spdx.org/licenses/FSFULLR",
    text: "FSF Unlimited License (with License Retention)",
  },
  {
    value: "http://spdx.org/licenses/FSFULLRWD",
    text: "FSF Unlimited License (With License Retention and Warranty Disclaimer)",
  },
  {
    value: "http://spdx.org/licenses/FTL",
    text: "Freetype Project License",
  },
  {
    value: "http://spdx.org/licenses/Furuseth",
    text: "Furuseth License",
  },
  {
    value: "http://spdx.org/licenses/fwlw",
    text: "fwlw License",
  },
  {
    value: "http://spdx.org/licenses/GD",
    text: "GD License",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.1-invariants-only",
    text: "GNU Free Documentation License v1.1 only - invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.1-invariants-or-later",
    text: "GNU Free Documentation License v1.1 or later - invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.1-no-invariants-only",
    text: "GNU Free Documentation License v1.1 only - no invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.1-no-invariants-or-later",
    text: "GNU Free Documentation License v1.1 or later - no invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.1-only",
    text: "GNU Free Documentation License v1.1 only",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.1-or-later",
    text: "GNU Free Documentation License v1.1 or later",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.2-invariants-only",
    text: "GNU Free Documentation License v1.2 only - invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.2-invariants-or-later",
    text: "GNU Free Documentation License v1.2 or later - invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.2-no-invariants-only",
    text: "GNU Free Documentation License v1.2 only - no invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.2-no-invariants-or-later",
    text: "GNU Free Documentation License v1.2 or later - no invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.2-only",
    text: "GNU Free Documentation License v1.2 only",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.2-or-later",
    text: "GNU Free Documentation License v1.2 or later",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.3-invariants-only",
    text: "GNU Free Documentation License v1.3 only - invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.3-invariants-or-later",
    text: "GNU Free Documentation License v1.3 or later - invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.3-no-invariants-only",
    text: "GNU Free Documentation License v1.3 only - no invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.3-no-invariants-or-later",
    text: "GNU Free Documentation License v1.3 or later - no invariants",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.3-only",
    text: "GNU Free Documentation License v1.3 only",
  },
  {
    value: "http://spdx.org/licenses/GFDL-1.3-or-later",
    text: "GNU Free Documentation License v1.3 or later",
  },
  {
    value: "http://spdx.org/licenses/Giftware",
    text: "Giftware License",
  },
  {
    value: "http://spdx.org/licenses/GL2PS",
    text: "GL2PS License",
  },
  {
    value: "http://spdx.org/licenses/Glide",
    text: "3dfx Glide License",
  },
  {
    value: "http://spdx.org/licenses/Glulxe",
    text: "Glulxe License",
  },
  {
    value: "http://spdx.org/licenses/GLWTPL",
    text: "Good Luck With That Public License",
  },
  {
    value: "http://spdx.org/licenses/gnuplot",
    text: "gnuplot License",
  },
  {
    value: "http://spdx.org/licenses/GPL-1.0-only",
    text: "GNU General Public License v1.0 only",
  },
  {
    value: "http://spdx.org/licenses/GPL-1.0-or-later",
    text: "GNU General Public License v1.0 or later",
  },
  {
    value: "http://spdx.org/licenses/GPL-2.0-only",
    text: "GNU General Public License v2.0 only",
  },
  {
    value: "http://spdx.org/licenses/GPL-2.0-or-later",
    text: "GNU General Public License v2.0 or later",
  },
  {
    value: "http://spdx.org/licenses/GPL-3.0-only",
    text: "GNU General Public License v3.0 only",
  },
  {
    value: "http://spdx.org/licenses/GPL-3.0-or-later",
    text: "GNU General Public License v3.0 or later",
  },
  {
    value: "http://spdx.org/licenses/Graphics-Gems",
    text: "Graphics Gems License",
  },
  {
    value: "http://spdx.org/licenses/gSOAP-1.3b",
    text: "gSOAP Public License v1.3b",
  },
  {
    value: "http://spdx.org/licenses/HaskellReport",
    text: "Haskell Language Report License",
  },
  {
    value: "http://spdx.org/licenses/Hippocratic-2.1",
    text: "Hippocratic License 2.1",
  },
  {
    value: "http://spdx.org/licenses/HP-1986",
    text: "Hewlett-Packard 1986 License",
  },
  {
    value: "http://spdx.org/licenses/HP-1989",
    text: "Hewlett-Packard 1989 License",
  },
  {
    value: "http://spdx.org/licenses/HPND",
    text: "Historical Permission Notice and Disclaimer",
  },
  {
    value: "http://spdx.org/licenses/HPND-DEC",
    text: "Historical Permission Notice and Disclaimer - DEC variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-doc",
    text: "Historical Permission Notice and Disclaimer - documentation variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-doc-sell",
    text: "Historical Permission Notice and Disclaimer - documentation sell variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-export-US",
    text: "HPND with US Government export control warning",
  },
  {
    value: "http://spdx.org/licenses/HPND-export-US-modify",
    text: "HPND with US Government export control warning and modification rqmt",
  },
  {
    value: "http://spdx.org/licenses/HPND-Markus-Kuhn",
    text: "Historical Permission Notice and Disclaimer - Markus Kuhn variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-Pbmplus",
    text: "Historical Permission Notice and Disclaimer - Pbmplus variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-sell-regexpr",
    text: "Historical Permission Notice and Disclaimer - sell regexpr variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-sell-variant",
    text: "Historical Permission Notice and Disclaimer - sell variant",
  },
  {
    value: "http://spdx.org/licenses/HPND-sell-variant-MIT-disclaimer",
    text: "HPND sell variant with MIT disclaimer",
  },
  {
    value: "http://spdx.org/licenses/HPND-UC",
    text: "Historical Permission Notice and Disclaimer - University of California variant",
  },
  {
    value: "http://spdx.org/licenses/HTMLTIDY",
    text: "HTML Tidy License",
  },
  {
    value: "http://spdx.org/licenses/IBM-pibs",
    text: "IBM PowerPC Initialization and Boot Software",
  },
  {
    value: "http://spdx.org/licenses/ICU",
    text: "ICU License",
  },
  {
    value: "http://spdx.org/licenses/IEC-Code-Components-EULA",
    text: "IEC    Code Components End-user licence agreement",
  },
  {
    value: "http://spdx.org/licenses/IJG",
    text: "Independent JPEG Group License",
  },
  {
    value: "http://spdx.org/licenses/IJG-short",
    text: "Independent JPEG Group License - short",
  },
  {
    value: "http://spdx.org/licenses/ImageMagick",
    text: "ImageMagick License",
  },
  {
    value: "http://spdx.org/licenses/iMatix",
    text: "iMatix Standard Function Library Agreement",
  },
  {
    value: "http://spdx.org/licenses/Imlib2",
    text: "Imlib2 License",
  },
  {
    value: "http://spdx.org/licenses/Info-ZIP",
    text: "Info-ZIP License",
  },
  {
    value: "http://spdx.org/licenses/Inner-Net-2.0",
    text: "Inner Net License v2.0",
  },
  {
    value: "http://spdx.org/licenses/Intel",
    text: "Intel Open Source License",
  },
  {
    value: "http://spdx.org/licenses/Intel-ACPI",
    text: "Intel ACPI Software License Agreement",
  },
  {
    value: "http://spdx.org/licenses/Interbase-1.0",
    text: "Interbase Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/IPA",
    text: "IPA Font License",
  },
  {
    value: "http://spdx.org/licenses/IPL-1.0",
    text: "IBM Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/ISC",
    text: "ISC License",
  },
  {
    value: "http://spdx.org/licenses/Jam",
    text: "Jam License",
  },
  {
    value: "http://spdx.org/licenses/JasPer-2.0",
    text: "JasPer License",
  },
  {
    value: "http://spdx.org/licenses/JPL-image",
    text: "JPL Image Use Policy",
  },
  {
    value: "http://spdx.org/licenses/JPNIC",
    text: "Japan Network Information Center License",
  },
  {
    value: "http://spdx.org/licenses/JSON",
    text: "JSON License",
  },
  {
    value: "http://spdx.org/licenses/Kastrup",
    text: "Kastrup License",
  },
  {
    value: "http://spdx.org/licenses/Kazlib",
    text: "Kazlib License",
  },
  {
    value: "http://spdx.org/licenses/Knuth-CTAN",
    text: "Knuth CTAN License",
  },
  {
    value: "http://spdx.org/licenses/LAL-1.2",
    text: "Licence Art Libre 1.2",
  },
  {
    value: "http://spdx.org/licenses/LAL-1.3",
    text: "Licence Art Libre 1.3",
  },
  {
    value: "http://spdx.org/licenses/Latex2e",
    text: "Latex2e License",
  },
  {
    value: "http://spdx.org/licenses/Latex2e-translated-notice",
    text: "Latex2e with translated notice permission",
  },
  {
    value: "http://spdx.org/licenses/Leptonica",
    text: "Leptonica License",
  },
  {
    value: "http://spdx.org/licenses/LGPL-2.0-only",
    text: "GNU Library General Public License v2 only",
  },
  {
    value: "http://spdx.org/licenses/LGPL-2.0-or-later",
    text: "GNU Library General Public License v2 or later",
  },
  {
    value: "http://spdx.org/licenses/LGPL-2.1-only",
    text: "GNU Lesser General Public License v2.1 only",
  },
  {
    value: "http://spdx.org/licenses/LGPL-2.1-or-later",
    text: "GNU Lesser General Public License v2.1 or later",
  },
  {
    value: "http://spdx.org/licenses/LGPL-3.0-only",
    text: "GNU Lesser General Public License v3.0 only",
  },
  {
    value: "http://spdx.org/licenses/LGPL-3.0-or-later",
    text: "GNU Lesser General Public License v3.0 or later",
  },
  {
    value: "http://spdx.org/licenses/LGPLLR",
    text: "Lesser General Public License For Linguistic Resources",
  },
  {
    value: "http://spdx.org/licenses/Libpng",
    text: "libpng License",
  },
  {
    value: "http://spdx.org/licenses/libpng-2.0",
    text: "PNG Reference Library version 2",
  },
  {
    value: "http://spdx.org/licenses/libselinux-1.0",
    text: "libselinux public domain notice",
  },
  {
    value: "http://spdx.org/licenses/libtiff",
    text: "libtiff License",
  },
  {
    value: "http://spdx.org/licenses/libutil-David-Nugent",
    text: "libutil David Nugent License",
  },
  {
    value: "http://spdx.org/licenses/LiLiQ-P-1.1",
    text: "Licence Libre du Qu\\u00e9bec \\u2013 Permissive version 1.1",
  },
  {
    value: "http://spdx.org/licenses/LiLiQ-R-1.1",
    text: "Licence Libre du Qu\\u00e9bec \\u2013 R\\u00e9ciprocit\\u00e9 version 1.1",
  },
  {
    value: "http://spdx.org/licenses/LiLiQ-Rplus-1.1",
    text: "Licence Libre du Qu\\u00e9bec \\u2013 R\\u00e9ciprocit\\u00e9 forte version 1.1",
  },
  {
    value: "http://spdx.org/licenses/Linux-man-pages-1-para",
    text: "Linux man-pages - 1 paragraph",
  },
  {
    value: "http://spdx.org/licenses/Linux-man-pages-copyleft",
    text: "Linux man-pages Copyleft",
  },
  {
    value: "http://spdx.org/licenses/Linux-man-pages-copyleft-2-para",
    text: "Linux man-pages Copyleft - 2 paragraphs",
  },
  {
    value: "http://spdx.org/licenses/Linux-man-pages-copyleft-var",
    text: "Linux man-pages Copyleft Variant",
  },
  {
    value: "http://spdx.org/licenses/Linux-OpenIB",
    text: "Linux Kernel Variant of OpenIB.org license",
  },
  {
    value: "http://spdx.org/licenses/LOOP",
    text: "Common Lisp LOOP License",
  },
  {
    value: "http://spdx.org/licenses/LPL-1.0",
    text: "Lucent Public License Version 1.0",
  },
  {
    value: "http://spdx.org/licenses/LPL-1.02",
    text: "Lucent Public License v1.02",
  },
  {
    value: "http://spdx.org/licenses/LPPL-1.0",
    text: "LaTeX Project Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/LPPL-1.1",
    text: "LaTeX Project Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/LPPL-1.2",
    text: "LaTeX Project Public License v1.2",
  },
  {
    value: "http://spdx.org/licenses/LPPL-1.3a",
    text: "LaTeX Project Public License v1.3a",
  },
  {
    value: "http://spdx.org/licenses/LPPL-1.3c",
    text: "LaTeX Project Public License v1.3c",
  },
  {
    value: "http://spdx.org/licenses/lsof",
    text: "lsof License",
  },
  {
    value: "http://spdx.org/licenses/Lucida-Bitmap-Fonts",
    text: "Lucida Bitmap Fonts License",
  },
  {
    value: "http://spdx.org/licenses/LZMA-SDK-9.11-to-9.20",
    text: "LZMA SDK License (versions 9.11 to 9.20)",
  },
  {
    value: "http://spdx.org/licenses/LZMA-SDK-9.22",
    text: "LZMA SDK License (versions 9.22 and beyond)",
  },
  {
    value: "http://spdx.org/licenses/magaz",
    text: "magaz License",
  },
  {
    value: "http://spdx.org/licenses/MakeIndex",
    text: "MakeIndex License",
  },
  {
    value: "http://spdx.org/licenses/Martin-Birgmeier",
    text: "Martin Birgmeier License",
  },
  {
    value: "http://spdx.org/licenses/McPhee-slideshow",
    text: "McPhee Slideshow License",
  },
  {
    value: "http://spdx.org/licenses/metamail",
    text: "metamail License",
  },
  {
    value: "http://spdx.org/licenses/Minpack",
    text: "Minpack License",
  },
  {
    value: "http://spdx.org/licenses/MirOS",
    text: "The MirOS Licence",
  },
  {
    value: "http://spdx.org/licenses/MIT",
    text: "MIT License",
  },
  {
    value: "http://spdx.org/licenses/MIT-0",
    text: "MIT No Attribution",
  },
  {
    value: "http://spdx.org/licenses/MIT-advertising",
    text: "Enlightenment License (e16)",
  },
  {
    value: "http://spdx.org/licenses/MIT-CMU",
    text: "CMU License",
  },
  {
    value: "http://spdx.org/licenses/MIT-enna",
    text: "enna License",
  },
  {
    value: "http://spdx.org/licenses/MIT-feh",
    text: "feh License",
  },
  {
    value: "http://spdx.org/licenses/MIT-Festival",
    text: "MIT Festival Variant",
  },
  {
    value: "http://spdx.org/licenses/MIT-Modern-Variant",
    text: "MIT License Modern Variant",
  },
  {
    value: "http://spdx.org/licenses/MIT-open-group",
    text: "MIT Open Group variant",
  },
  {
    value: "http://spdx.org/licenses/MIT-testregex",
    text: "MIT testregex Variant",
  },
  {
    value: "http://spdx.org/licenses/MIT-Wu",
    text: "MIT Tom Wu Variant",
  },
  {
    value: "http://spdx.org/licenses/MITNFA",
    text: "MIT +no-false-attribs license",
  },
  {
    value: "http://spdx.org/licenses/MMIXware",
    text: "MMIXware License",
  },
  {
    value: "http://spdx.org/licenses/Motosoto",
    text: "Motosoto License",
  },
  {
    value: "http://spdx.org/licenses/MPEG-SSG",
    text: "MPEG Software Simulation",
  },
  {
    value: "http://spdx.org/licenses/mpi-permissive",
    text: "mpi Permissive License",
  },
  {
    value: "http://spdx.org/licenses/mpich2",
    text: "mpich2 License",
  },
  {
    value: "http://spdx.org/licenses/MPL-1.0",
    text: "Mozilla Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/MPL-1.1",
    text: "Mozilla Public License 1.1",
  },
  {
    value: "http://spdx.org/licenses/MPL-2.0",
    text: "Mozilla Public License 2.0",
  },
  {
    value: "http://spdx.org/licenses/MPL-2.0-no-copyleft-exception",
    text: "Mozilla Public License 2.0 (no copyleft exception)",
  },
  {
    value: "http://spdx.org/licenses/mplus",
    text: "mplus Font License",
  },
  {
    value: "http://spdx.org/licenses/MS-LPL",
    text: "Microsoft Limited Public License",
  },
  {
    value: "http://spdx.org/licenses/MS-PL",
    text: "Microsoft Public License",
  },
  {
    value: "http://spdx.org/licenses/MS-RL",
    text: "Microsoft Reciprocal License",
  },
  {
    value: "http://spdx.org/licenses/MTLL",
    text: "Matrix Template Library License",
  },
  {
    value: "http://spdx.org/licenses/MulanPSL-1.0",
    text: "Mulan Permissive Software License, Version 1",
  },
  {
    value: "http://spdx.org/licenses/MulanPSL-2.0",
    text: "Mulan Permissive Software License, Version 2",
  },
  {
    value: "http://spdx.org/licenses/Multics",
    text: "Multics License",
  },
  {
    value: "http://spdx.org/licenses/Mup",
    text: "Mup License",
  },
  {
    value: "http://spdx.org/licenses/NAIST-2003",
    text: "Nara Institute of Science and Technology License (2003)",
  },
  {
    value: "http://spdx.org/licenses/NASA-1.3",
    text: "NASA Open Source Agreement 1.3",
  },
  {
    value: "http://spdx.org/licenses/Naumen",
    text: "Naumen Public License",
  },
  {
    value: "http://spdx.org/licenses/NBPL-1.0",
    text: "Net Boolean Public License v1",
  },
  {
    value: "http://spdx.org/licenses/NCGL-UK-2.0",
    text: "Non-Commercial Government Licence",
  },
  {
    value: "http://spdx.org/licenses/NCSA",
    text: "University of Illinois/NCSA Open Source License",
  },
  {
    value: "http://spdx.org/licenses/Net-SNMP",
    text: "Net-SNMP License",
  },
  {
    value: "http://spdx.org/licenses/NetCDF",
    text: "NetCDF license",
  },
  {
    value: "http://spdx.org/licenses/Newsletr",
    text: "Newsletr License",
  },
  {
    value: "http://spdx.org/licenses/NGPL",
    text: "Nethack General Public License",
  },
  {
    value: "http://spdx.org/licenses/NICTA-1.0",
    text: "NICTA Public Software License, Version 1.0",
  },
  {
    value: "http://spdx.org/licenses/NIST-PD",
    text: "NIST Public Domain Notice",
  },
  {
    value: "http://spdx.org/licenses/NIST-PD-fallback",
    text: "NIST Public Domain Notice with license fallback",
  },
  {
    value: "http://spdx.org/licenses/NIST-Software",
    text: "NIST Software License",
  },
  {
    value: "http://spdx.org/licenses/NLOD-1.0",
    text: "Norwegian Licence for Open Government Data (NLOD) 1.0",
  },
  {
    value: "http://spdx.org/licenses/NLOD-2.0",
    text: "Norwegian Licence for Open Government Data (NLOD) 2.0",
  },
  {
    value: "http://spdx.org/licenses/NLPL",
    text: "No Limit Public License",
  },
  {
    value: "http://spdx.org/licenses/Nokia",
    text: "Nokia Open Source License",
  },
  {
    value: "http://spdx.org/licenses/NOSL",
    text: "Netizen Open Source License",
  },
  {
    value: "http://spdx.org/licenses/Noweb",
    text: "Noweb License",
  },
  {
    value: "http://spdx.org/licenses/NPL-1.0",
    text: "Netscape Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/NPL-1.1",
    text: "Netscape Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/NPOSL-3.0",
    text: "Non-Profit Open Software License 3.0",
  },
  {
    value: "http://spdx.org/licenses/NRL",
    text: "NRL License",
  },
  {
    value: "http://spdx.org/licenses/NTP",
    text: "NTP License",
  },
  {
    value: "http://spdx.org/licenses/NTP-0",
    text: "NTP No Attribution",
  },
  {
    value: "http://spdx.org/licenses/O-UDA-1.0",
    text: "Open Use of Data Agreement v1.0",
  },
  {
    value: "http://spdx.org/licenses/OCCT-PL",
    text: "Open CASCADE Technology Public License",
  },
  {
    value: "http://spdx.org/licenses/OCLC-2.0",
    text: "OCLC Research Public License 2.0",
  },
  {
    value: "http://spdx.org/licenses/ODbL-1.0",
    text: "Open Data Commons Open Database License v1.0",
  },
  {
    value: "http://spdx.org/licenses/ODC-By-1.0",
    text: "Open Data Commons Attribution License v1.0",
  },
  {
    value: "http://spdx.org/licenses/OFFIS",
    text: "OFFIS License",
  },
  {
    value: "http://spdx.org/licenses/OFL-1.0",
    text: "SIL Open Font License 1.0",
  },
  {
    value: "http://spdx.org/licenses/OFL-1.0-no-RFN",
    text: "SIL Open Font License 1.0 with no Reserved Font Name",
  },
  {
    value: "http://spdx.org/licenses/OFL-1.0-RFN",
    text: "SIL Open Font License 1.0 with Reserved Font Name",
  },
  {
    value: "http://spdx.org/licenses/OFL-1.1",
    text: "SIL Open Font License 1.1",
  },
  {
    value: "http://spdx.org/licenses/OFL-1.1-no-RFN",
    text: "SIL Open Font License 1.1 with no Reserved Font Name",
  },
  {
    value: "http://spdx.org/licenses/OFL-1.1-RFN",
    text: "SIL Open Font License 1.1 with Reserved Font Name",
  },
  {
    value: "http://spdx.org/licenses/OGC-1.0",
    text: "OGC Software License, Version 1.0",
  },
  {
    value: "http://spdx.org/licenses/OGDL-Taiwan-1.0",
    text: "Taiwan Open Government Data License, version 1.0",
  },
  {
    value: "http://spdx.org/licenses/OGL-Canada-2.0",
    text: "Open Government Licence - Canada",
  },
  {
    value: "http://spdx.org/licenses/OGL-UK-1.0",
    text: "Open Government Licence v1.0",
  },
  {
    value: "http://spdx.org/licenses/OGL-UK-2.0",
    text: "Open Government Licence v2.0",
  },
  {
    value: "http://spdx.org/licenses/OGL-UK-3.0",
    text: "Open Government Licence v3.0",
  },
  {
    value: "http://spdx.org/licenses/OGTSL",
    text: "Open Group Test Suite License",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-1.1",
    text: "Open LDAP Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-1.2",
    text: "Open LDAP Public License v1.2",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-1.3",
    text: "Open LDAP Public License v1.3",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-1.4",
    text: "Open LDAP Public License v1.4",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.0",
    text: "Open LDAP Public License v2.0 (or possibly 2.0A and 2.0B)",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.0.1",
    text: "Open LDAP Public License v2.0.1",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.1",
    text: "Open LDAP Public License v2.1",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.2",
    text: "Open LDAP Public License v2.2",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.2.1",
    text: "Open LDAP Public License v2.2.1",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.2.2",
    text: "Open LDAP Public License 2.2.2",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.3",
    text: "Open LDAP Public License v2.3",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.4",
    text: "Open LDAP Public License v2.4",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.5",
    text: "Open LDAP Public License v2.5",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.6",
    text: "Open LDAP Public License v2.6",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.7",
    text: "Open LDAP Public License v2.7",
  },
  {
    value: "http://spdx.org/licenses/OLDAP-2.8",
    text: "Open LDAP Public License v2.8",
  },
  {
    value: "http://spdx.org/licenses/OLFL-1.3",
    text: "Open Logistics Foundation License Version 1.3",
  },
  {
    value: "http://spdx.org/licenses/OML",
    text: "Open Market License",
  },
  {
    value: "http://spdx.org/licenses/OpenPBS-2.3",
    text: "OpenPBS v2.3 Software License",
  },
  {
    value: "http://spdx.org/licenses/OpenSSL",
    text: "OpenSSL License",
  },
  {
    value: "http://spdx.org/licenses/OPL-1.0",
    text: "Open Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/OPL-UK-3.0",
    text: "United    Kingdom Open Parliament Licence v3.0",
  },
  {
    value: "http://spdx.org/licenses/OPUBL-1.0",
    text: "Open Publication License v1.0",
  },
  {
    value: "http://spdx.org/licenses/OSET-PL-2.1",
    text: "OSET Public License version 2.1",
  },
  {
    value: "http://spdx.org/licenses/OSL-1.0",
    text: "Open Software License 1.0",
  },
  {
    value: "http://spdx.org/licenses/OSL-1.1",
    text: "Open Software License 1.1",
  },
  {
    value: "http://spdx.org/licenses/OSL-2.0",
    text: "Open Software License 2.0",
  },
  {
    value: "http://spdx.org/licenses/OSL-2.1",
    text: "Open Software License 2.1",
  },
  {
    value: "http://spdx.org/licenses/OSL-3.0",
    text: "Open Software License 3.0",
  },
  {
    value: "http://spdx.org/licenses/PADL",
    text: "PADL License",
  },
  {
    value: "http://spdx.org/licenses/Parity-6.0.0",
    text: "The Parity Public License 6.0.0",
  },
  {
    value: "http://spdx.org/licenses/Parity-7.0.0",
    text: "The Parity Public License 7.0.0",
  },
  {
    value: "http://spdx.org/licenses/PDDL-1.0",
    text: "Open Data Commons Public Domain Dedication & License 1.0",
  },
  {
    value: "http://spdx.org/licenses/PHP-3.0",
    text: "PHP License v3.0",
  },
  {
    value: "http://spdx.org/licenses/PHP-3.01",
    text: "PHP License v3.01",
  },
  {
    value: "http://spdx.org/licenses/Plexus",
    text: "Plexus Classworlds License",
  },
  {
    value: "http://spdx.org/licenses/pnmstitch",
    text: "pnmstitch License",
  },
  {
    value: "http://spdx.org/licenses/PolyForm-Noncommercial-1.0.0",
    text: "PolyForm Noncommercial License 1.0.0",
  },
  {
    value: "http://spdx.org/licenses/PolyForm-Small-Business-1.0.0",
    text: "PolyForm Small Business License 1.0.0",
  },
  {
    value: "http://spdx.org/licenses/PostgreSQL",
    text: "PostgreSQL License",
  },
  {
    value: "http://spdx.org/licenses/PSF-2.0",
    text: "Python Software Foundation License 2.0",
  },
  {
    value: "http://spdx.org/licenses/psfrag",
    text: "psfrag License",
  },
  {
    value: "http://spdx.org/licenses/psutils",
    text: "psutils License",
  },
  {
    value: "http://spdx.org/licenses/Python-2.0",
    text: "Python License 2.0",
  },
  {
    value: "http://spdx.org/licenses/Python-2.0.1",
    text: "Python License 2.0.1",
  },
  {
    value: "http://spdx.org/licenses/python-ldap",
    text: "Python ldap License",
  },
  {
    value: "http://spdx.org/licenses/Qhull",
    text: "Qhull License",
  },
  {
    value: "http://spdx.org/licenses/QPL-1.0",
    text: "Q Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/QPL-1.0-INRIA-2004",
    text: "Q Public License 1.0 - INRIA 2004 variant",
  },
  {
    value: "http://spdx.org/licenses/Rdisc",
    text: "Rdisc License",
  },
  {
    value: "http://spdx.org/licenses/RHeCos-1.1",
    text: "Red Hat eCos Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/RPL-1.1",
    text: "Reciprocal Public License 1.1",
  },
  {
    value: "http://spdx.org/licenses/RPL-1.5",
    text: "Reciprocal Public License 1.5",
  },
  {
    value: "http://spdx.org/licenses/RPSL-1.0",
    text: "RealNetworks Public Source License v1.0",
  },
  {
    value: "http://spdx.org/licenses/RSA-MD",
    text: "RSA Message-Digest License",
  },
  {
    value: "http://spdx.org/licenses/RSCPL",
    text: "Ricoh Source Code Public License",
  },
  {
    value: "http://spdx.org/licenses/Ruby",
    text: "Ruby License",
  },
  {
    value: "http://spdx.org/licenses/SAX-PD",
    text: "Sax Public Domain Notice",
  },
  {
    value: "http://spdx.org/licenses/Saxpath",
    text: "Saxpath License",
  },
  {
    value: "http://spdx.org/licenses/SCEA",
    text: "SCEA Shared Source License",
  },
  {
    value: "http://spdx.org/licenses/SchemeReport",
    text: "Scheme Language Report License",
  },
  {
    value: "http://spdx.org/licenses/Sendmail",
    text: "Sendmail License",
  },
  {
    value: "http://spdx.org/licenses/Sendmail-8.23",
    text: "Sendmail License 8.23",
  },
  {
    value: "http://spdx.org/licenses/SGI-B-1.0",
    text: "SGI Free Software License B v1.0",
  },
  {
    value: "http://spdx.org/licenses/SGI-B-1.1",
    text: "SGI Free Software License B v1.1",
  },
  {
    value: "http://spdx.org/licenses/SGI-B-2.0",
    text: "SGI Free Software License B v2.0",
  },
  {
    value: "http://spdx.org/licenses/SGI-OpenGL",
    text: "SGI OpenGL License",
  },
  {
    value: "http://spdx.org/licenses/SGP4",
    text: "SGP4 Permission Notice",
  },
  {
    value: "http://spdx.org/licenses/SHL-0.5",
    text: "Solderpad Hardware License v0.5",
  },
  {
    value: "http://spdx.org/licenses/SHL-0.51",
    text: "Solderpad Hardware License, Version 0.51",
  },
  {
    value: "http://spdx.org/licenses/SimPL-2.0",
    text: "Simple Public License 2.0",
  },
  {
    value: "http://spdx.org/licenses/SISSL",
    text: "Sun Industry Standards Source License v1.1",
  },
  {
    value: "http://spdx.org/licenses/SISSL-1.2",
    text: "Sun Industry Standards Source License v1.2",
  },
  {
    value: "http://spdx.org/licenses/SL",
    text: "SL License",
  },
  {
    value: "http://spdx.org/licenses/Sleepycat",
    text: "Sleepycat License",
  },
  {
    value: "http://spdx.org/licenses/SMLNJ",
    text: "Standard ML of New Jersey License",
  },
  {
    value: "http://spdx.org/licenses/SMPPL",
    text: "Secure Messaging Protocol Public License",
  },
  {
    value: "http://spdx.org/licenses/SNIA",
    text: "SNIA Public License 1.1",
  },
  {
    value: "http://spdx.org/licenses/snprintf",
    text: "snprintf License",
  },
  {
    value: "http://spdx.org/licenses/Soundex",
    text: "Soundex License",
  },
  {
    value: "http://spdx.org/licenses/Spencer-86",
    text: "Spencer License 86",
  },
  {
    value: "http://spdx.org/licenses/Spencer-94",
    text: "Spencer License 94",
  },
  {
    value: "http://spdx.org/licenses/Spencer-99",
    text: "Spencer License 99",
  },
  {
    value: "http://spdx.org/licenses/SPL-1.0",
    text: "Sun Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/ssh-keyscan",
    text: "ssh-keyscan License",
  },
  {
    value: "http://spdx.org/licenses/SSH-OpenSSH",
    text: "SSH OpenSSH license",
  },
  {
    value: "http://spdx.org/licenses/SSH-short",
    text: "SSH short notice",
  },
  {
    value: "http://spdx.org/licenses/SSPL-1.0",
    text: "Server Side Public License, v 1",
  },
  {
    value: "http://spdx.org/licenses/SugarCRM-1.1.3",
    text: "SugarCRM Public License v1.1.3",
  },
  {
    value: "http://spdx.org/licenses/SunPro",
    text: "SunPro License",
  },
  {
    value: "http://spdx.org/licenses/SWL",
    text: "Scheme Widget Library (SWL) Software License Agreement",
  },
  {
    value: "http://spdx.org/licenses/swrule",
    text: "swrule License",
  },
  {
    value: "http://spdx.org/licenses/Symlinks",
    text: "Symlinks License",
  },
  {
    value: "http://spdx.org/licenses/TAPR-OHL-1.0",
    text: "TAPR Open Hardware License v1.0",
  },
  {
    value: "http://spdx.org/licenses/TCL",
    text: "TCL/TK License",
  },
  {
    value: "http://spdx.org/licenses/TCP-wrappers",
    text: "TCP Wrappers License",
  },
  {
    value: "http://spdx.org/licenses/TermReadKey",
    text: "TermReadKey License",
  },
  {
    value: "http://spdx.org/licenses/TMate",
    text: "TMate Open Source License",
  },
  {
    value: "http://spdx.org/licenses/TORQUE-1.1",
    text: "TORQUE v2.5+ Software License v1.1",
  },
  {
    value: "http://spdx.org/licenses/TOSL",
    text: "Trusster Open Source License",
  },
  {
    value: "http://spdx.org/licenses/TPDL",
    text: "Time::ParseDate License",
  },
  {
    value: "http://spdx.org/licenses/TPL-1.0",
    text: "THOR Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/TTWL",
    text: "Text-Tabs+Wrap License",
  },
  {
    value: "http://spdx.org/licenses/TTYP0",
    text: "TTYP0 License",
  },
  {
    value: "http://spdx.org/licenses/TU-Berlin-1.0",
    text: "Technische Universitaet Berlin License 1.0",
  },
  {
    value: "http://spdx.org/licenses/TU-Berlin-2.0",
    text: "Technische Universitaet Berlin License 2.0",
  },
  {
    value: "http://spdx.org/licenses/UCAR",
    text: "UCAR License",
  },
  {
    value: "http://spdx.org/licenses/UCL-1.0",
    text: "Upstream Compatibility License v1.0",
  },
  {
    value: "http://spdx.org/licenses/ulem",
    text: "ulem License",
  },
  {
    value: "http://spdx.org/licenses/Unicode-DFS-2015",
    text: "Unicode License Agreement - Data Files and Software (2015)",
  },
  {
    value: "http://spdx.org/licenses/Unicode-DFS-2016",
    text: "Unicode License Agreement - Data Files and Software (2016)",
  },
  {
    value: "http://spdx.org/licenses/Unicode-TOU",
    text: "Unicode Terms of Use",
  },
  {
    value: "http://spdx.org/licenses/UnixCrypt",
    text: "UnixCrypt License",
  },
  {
    value: "http://spdx.org/licenses/Unlicense",
    text: "The Unlicense",
  },
  {
    value: "http://spdx.org/licenses/UPL-1.0",
    text: "Universal Permissive License v1.0",
  },
  {
    value: "http://spdx.org/licenses/URT-RLE",
    text: "Utah Raster Toolkit Run Length Encoded License",
  },
  {
    value: "http://spdx.org/licenses/Vim",
    text: "Vim License",
  },
  {
    value: "http://spdx.org/licenses/VOSTROM",
    text: "VOSTROM Public License for Open Source",
  },
  {
    value: "http://spdx.org/licenses/VSL-1.0",
    text: "Vovida Software License v1.0",
  },
  {
    value: "http://spdx.org/licenses/W3C",
    text: "W3C Software Notice and License (2002-12-31)",
  },
  {
    value: "http://spdx.org/licenses/W3C-19980720",
    text: "W3C Software Notice and License (1998-07-20)",
  },
  {
    value: "http://spdx.org/licenses/W3C-20150513",
    text: "W3C Software Notice and Document License (2015-05-13)",
  },
  {
    value: "http://spdx.org/licenses/w3m",
    text: "w3m License",
  },
  {
    value: "http://spdx.org/licenses/Watcom-1.0",
    text: "Sybase Open Watcom Public License 1.0",
  },
  {
    value: "http://spdx.org/licenses/Widget-Workshop",
    text: "Widget Workshop License",
  },
  {
    value: "http://spdx.org/licenses/Wsuipa",
    text: "Wsuipa License",
  },
  {
    value: "http://spdx.org/licenses/WTFPL",
    text: "Do What The F*ck You Want To Public License",
  },
  {
    value: "http://spdx.org/licenses/X11",
    text: "X11 License",
  },
  {
    value: "http://spdx.org/licenses/X11-distribute-modifications-variant",
    text: "X11 License Distribution Modification Variant",
  },
  {
    value: "http://spdx.org/licenses/Xdebug-1.03",
    text: "Xdebug License v 1.03",
  },
  {
    value: "http://spdx.org/licenses/Xerox",
    text: "Xerox License",
  },
  {
    value: "http://spdx.org/licenses/Xfig",
    text: "Xfig License",
  },
  {
    value: "http://spdx.org/licenses/XFree86-1.1",
    text: "XFree86 License 1.1",
  },
  {
    value: "http://spdx.org/licenses/xinetd",
    text: "xinetd License",
  },
  {
    value: "http://spdx.org/licenses/xlock",
    text: "xlock License",
  },
  {
    value: "http://spdx.org/licenses/Xnet",
    text: "X.Net License",
  },
  {
    value: "http://spdx.org/licenses/xpp",
    text: "XPP License",
  },
  {
    value: "http://spdx.org/licenses/XSkat",
    text: "XSkat License",
  },
  {
    value: "http://spdx.org/licenses/YPL-1.0",
    text: "Yahoo! Public License v1.0",
  },
  {
    value: "http://spdx.org/licenses/YPL-1.1",
    text: "Yahoo! Public License v1.1",
  },
  {
    value: "http://spdx.org/licenses/Zed",
    text: "Zed License",
  },
  {
    value: "http://spdx.org/licenses/Zeeff",
    text: "Zeeff License",
  },
  {
    value: "http://spdx.org/licenses/Zend-2.0",
    text: "Zend License v2.0",
  },
  {
    value: "http://spdx.org/licenses/Zimbra-1.3",
    text: "Zimbra Public License v1.3",
  },
  {
    value: "http://spdx.org/licenses/Zimbra-1.4",
    text: "Zimbra Public License v1.4",
  },
  {
    value: "http://spdx.org/licenses/Zlib",
    text: "zlib License",
  },
  {
    value: "http://spdx.org/licenses/zlib-acknowledgement",
    text: "zlib/libpng License with Acknowledgement",
  },
  {
    value: "http://spdx.org/licenses/ZPL-1.1",
    text: "Zope Public License 1.1",
  },
  {
    value: "http://spdx.org/licenses/ZPL-2.0",
    text: "Zope Public License 2.0",
  },
  {
    value: "http://spdx.org/licenses/ZPL-2.1",
    text: "Zope Public License 2.1",
  },
].sort((a, b) => a.text.localeCompare(b.text));