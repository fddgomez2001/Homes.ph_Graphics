/**
 * The places each Trending news area covers, and the places it doesn't (data only: no imports, so the
 * place lists, the searches and the checks can all use it). Homes.ph Gensan is General Santos City only
 * (the team's choice, 1.47): Koronadal, Polomolok, South Cotabato, Sarangani… are other places.
 */

/** General Santos City: its names, its distinct barangays and what only GenSan has (the most specific first). */
export const GENSAN_NAMES: readonly string[] = [
  "General Santos City", "General Santos", "Gen. Santos", "GenSan", "Gensan City",
  "Dadiangas", "Labangal", "Calumpang", "Lagao", "Apopong", "Tambler", "Conel", "Katangawan", "Olympog", "Sinawal", "Siguel", "Tinagacan",
  "Batomelong", "Tuna Capital", "Kalilangan",
]

/** The Caraga region (Butuan, the Agusan and Surigao provinces, Siargao, Dinagat) and its distinct towns. */
export const CARAGA_NAMES: readonly string[] = [
  "Butuan City", "Surigao City", "Surigao del Norte", "Surigao del Sur", "Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Siargao",
  "Bislig", "Tandag", "Bayugan", "Cabadbaran", "Nasipit", "Prosperidad", "Trento", "Bunawan", "Sibagat", "Talacogon", "Dapa", "General Luna",
  "Del Carmen", "Hinatuan", "Lianga", "Cantilan", "Carrascal", "Lanuza", "Barobo", "Basilisa", "Claver", "Kitcharao", "Jabonga", "Tubay",
  "Butuan", "Surigao", "Agusan", "Dinagat", "Caraga",
]

/**
 * Philippine places, for "is this story somewhere else?": a story that names one of these and none of
 * the page's own places is in another place. (Mindanao, Visayas and Luzon alone say nothing either way.)
 */
export const PH_PLACES: readonly string[] = [
  // Metro Manila and Luzon
  "Metro Manila", "NCR", "Quezon City", "Manila", "Makati", "Taguig", "BGC", "Bonifacio Global City", "Pasig", "Mandaluyong", "Parañaque", "Pasay",
  "Muntinlupa", "Alabang", "Caloocan", "Marikina", "Valenzuela", "Las Piñas", "San Juan City", "Antipolo", "Rizal", "Cavite", "Tagaytay", "Imus",
  "Bacoor", "Dasmariñas", "Laguna", "Calamba", "Santa Rosa", "Biñan", "Batangas", "Lipa", "Lucena", "Bulacan", "Malolos", "Pampanga", "Clark",
  "Angeles City", "Tarlac", "Nueva Ecija", "Cabanatuan", "Bataan", "Subic", "Olongapo", "Zambales", "Pangasinan", "Dagupan", "La Union", "Baguio",
  "Benguet", "Ilocos", "Vigan", "Laoag", "Isabela", "Tuguegarao", "Cagayan Valley", "Albay", "Legazpi", "Naga City", "Camarines Sur", "Sorsogon",
  "Masbate", "Catanduanes", "Marinduque", "Romblon", "Mindoro", "Palawan", "Puerto Princesa", "El Nido", "Coron",
  // Visayas
  "Cebu", "Mandaue", "Lapu-Lapu", "Mactan", "Bohol", "Tagbilaran", "Panglao", "Iloilo", "Bacolod", "Negros Occidental", "Negros Oriental",
  "Dumaguete", "Siquijor", "Aklan", "Boracay", "Kalibo", "Capiz", "Roxas City", "Antique", "Guimaras", "Leyte", "Tacloban", "Ormoc", "Samar",
  "Catbalogan", "Calbayog", "Borongan", "Biliran",
  // Mindanao (outside Caraga and GenSan)
  "Davao", "Tagum", "Panabo", "Samal", "Digos", "Mati", "Cagayan de Oro", "CDO", "Misamis Oriental", "Misamis Occidental", "Ozamiz", "Oroquieta",
  "Tangub", "Iligan", "Lanao del Norte", "Lanao del Sur", "Marawi", "Bukidnon", "Malaybalay", "Valencia City", "Camiguin", "Gingoog",
  "Zamboanga", "Pagadian", "Dipolog", "Dapitan", "Cotabato City", "Cotabato", "Kidapawan", "Maguindanao", "BARMM", "Bangsamoro", "Basilan",
  "Sulu", "Jolo", "Tawi-Tawi",
  // SOCCSKSARGEN outside General Santos City
  "SOCCSKSARGEN", "Region 12", "Region XII", "South Cotabato", "Koronadal", "Polomolok", "Tupi", "Tampakan", "T'boli", "Lake Sebu", "Banga",
  "Surallah", "Norala", "Sto. Niño", "Santo Niño", "Sarangani", "Alabel", "Glan", "Maitum", "Kiamba", "Maasim", "Malapatan", "Malungon",
  "Sultan Kudarat", "Tacurong", "Isulan",
  // Caraga
  ...CARAGA_NAMES,
  // General Santos City
  ...GENSAN_NAMES,
]

/** The Philippines and Filipinos: what makes a pickleball story PicklePlay's. */
export const PH_MARKERS: readonly string[] = ["Philippines", "Philippine", "Pilipinas", "Filipino", "Filipina", "Filipinos", "Pinoy", "Pinay", "PH", "Team Philippines", "PPF", "PPL"]

/** Other countries and their best-known pickleball places: a pickleball story only there isn't PicklePlay's. */
export const FOREIGN_PLACES: readonly string[] = [
  "United States", "USA", "U.S.", "US Open", "America", "American", "Canada", "Canadian", "Mexico", "Australia", "Australian", "New Zealand",
  "United Kingdom", "UK", "England", "British", "Ireland", "Europe", "European", "Spain", "Germany", "France", "Italy", "Netherlands",
  "India", "Indian", "Singapore", "Malaysia", "Malaysian", "Thailand", "Thai", "Vietnam", "Vietnamese", "Indonesia", "Indonesian", "Japan",
  "Japanese", "China", "Chinese", "Korea", "Korean", "Taiwan", "Hong Kong", "Dubai", "UAE", "Saudi", "Qatar",
  "Florida", "California", "Texas", "New York", "Arizona", "Nevada", "Las Vegas", "Utah", "Colorado", "Washington", "Oregon", "Ohio",
  "Michigan", "Illinois", "Chicago", "Pennsylvania", "Georgia", "Atlanta", "Dallas", "Houston", "Austin", "Miami", "Orlando", "Naples",
  "Phoenix", "Scottsdale", "San Diego", "Los Angeles", "Boston", "Denver", "Seattle", "Indian Wells", "Palm Springs",
]
