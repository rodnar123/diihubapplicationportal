import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  ApplicationStatus,
  AttachmentKind,
  CommentVisibility,
  DeclarationMode,
  Role,
  YearLevel,
} from "../src/generated/prisma/enums";
import { DEFAULT_APP_SETTINGS, APP_SETTING_DESCRIPTIONS } from "../src/domain/settings/app-settings";

/**
 * Idempotent seed.
 *
 * Reference data and settings are always written. Demo applications are only
 * created outside production, so running `prisma db seed` against a live
 * database cannot pollute it with fake teams.
 */

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CHALLENGE_YEAR = DEFAULT_APP_SETTINGS["challenge.year"];

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const SCHOOLS: Array<{
  code: string;
  name: string;
  sortOrder: number;
  sections: Array<{ code: string; name: string }>;
}> = [
  {
    code: "SBS",
    name: "School of Business Studies",
    sortOrder: 1,
    sections: [
      { code: "IT", name: "Information Technology" },
      { code: "ACC", name: "Accounting" },
      { code: "AEC", name: "Applied Economics" },
      { code: "MGT", name: "Management" },
      { code: "HRM", name: "Human Resource Management" },
      { code: "MKT", name: "Marketing" },
    ],
  },
  {
    code: "SAS",
    name: "School of Applied Sciences",
    sortOrder: 2,
    sections: [
      { code: "MCS", name: "Mathematics & Computer Science" },
      { code: "APH", name: "Applied Physics" },
      { code: "ACH", name: "Applied Chemistry" },
    ],
  },
  {
    code: "SOE",
    name: "School of Engineering",
    sortOrder: 3,
    sections: [
      { code: "CIV", name: "Civil Engineering" },
      { code: "MEC", name: "Mechanical Engineering" },
      { code: "ELC", name: "Electrical & Communication Engineering" },
      { code: "CHE", name: "Chemical Engineering" },
      { code: "MIN", name: "Mining Engineering" },
    ],
  },
  {
    code: "SNR",
    name: "School of Natural Resources",
    sortOrder: 4,
    sections: [
      { code: "AGR", name: "Agriculture" },
      { code: "FOR", name: "Forestry" },
      { code: "FMS", name: "Fisheries & Marine Studies" },
    ],
  },
  {
    code: "SBE",
    name: "School of Built Environment",
    sortOrder: 5,
    sections: [
      { code: "ARB", name: "Architecture & Building" },
      { code: "SLS", name: "Surveying & Land Studies" },
    ],
  },
];

async function seedReferenceData() {
  const sectionIds = new Map<string, string>();
  const schoolIds = new Map<string, string>();

  for (const school of SCHOOLS) {
    const record = await prisma.school.upsert({
      where: { code: school.code },
      update: { name: school.name, sortOrder: school.sortOrder, isActive: true },
      create: {
        code: school.code,
        name: school.name,
        sortOrder: school.sortOrder,
      },
    });
    schoolIds.set(school.code, record.id);

    for (const [index, section] of school.sections.entries()) {
      const sectionRecord = await prisma.section.upsert({
        where: { schoolId_code: { schoolId: record.id, code: section.code } },
        update: { name: section.name, sortOrder: index, isActive: true },
        create: {
          schoolId: record.id,
          code: section.code,
          name: section.name,
          sortOrder: index,
        },
      });
      sectionIds.set(`${school.code}:${section.code}`, sectionRecord.id);
    }
  }

  console.log(`  schools: ${schoolIds.size}, sections: ${sectionIds.size}`);
  return { schoolIds, sectionIds };
}

async function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_APP_SETTINGS)) {
    await prisma.appSetting.upsert({
      where: { key },
      // Existing values are left alone: an administrator's choices must
      // survive a re-seed.
      update: { description: APP_SETTING_DESCRIPTIONS[key as keyof typeof APP_SETTING_DESCRIPTIONS] },
      create: {
        key,
        value: value as never,
        description: APP_SETTING_DESCRIPTIONS[key as keyof typeof APP_SETTING_DESCRIPTIONS],
      },
    });
  }
  console.log(`  settings: ${Object.keys(DEFAULT_APP_SETTINGS).length}`);
}

async function seedAdministrators() {
  const configured = (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const admins = configured.length > 0 ? configured : ["challenge.admin@pnguot.ac.pg"];

  for (const email of admins) {
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, isActive: true },
      create: {
        email,
        name: "Challenge Administrator",
        role: Role.ADMIN,
      },
    });
  }

  console.log(`  administrators: ${admins.length} (${admins.join(", ")})`);
  return admins;
}

// ---------------------------------------------------------------------------
// Demo data (non-production only)
// ---------------------------------------------------------------------------

interface DemoApplication {
  studentId: string;
  firstName: string;
  surname: string;
  emailLocal: string;
  phone: string;
  schoolCode: string;
  sectionCode: string;
  program: string;
  yearLevel: YearLevel;
  status: ApplicationStatus;
  teamName: string;
  supervisor?: string;
  projectTitle: string;
  theme: string;
  sdg: string[];
  problemStatement: string;
  proposedSolution: string;
  innovation: string;
  objectives: string;
  targetUsers: string;
  expectedImpact: string;
  sustainability: string;
  timeline: string;
  prototypeType: string;
  prototypeFeatures: string;
  developmentTools: string;
  alternatives: string;
  justification: string;
  valueProposition: string;
  implementationPlan: string;
  budget?: number;
  members: Array<{
    studentId: string;
    firstName: string;
    surname: string;
    sectionCode: string;
    role: string;
  }>;
}

const p = (...paragraphs: string[]) => paragraphs.map((text) => `<p>${text}</p>`).join("");
const ul = (...items: string[]) => `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;

const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    studentId: "25530061",
    firstName: "Jose",
    surname: "Kaupa",
    emailLocal: "25530061jose",
    phone: "+675 7123 4567",
    schoolCode: "SBS",
    sectionCode: "IT",
    program: "Bachelor of Business (Information Technology)",
    yearLevel: YearLevel.YEAR_3,
    status: ApplicationStatus.SUBMITTED,
    teamName: "Highlands Digital",
    supervisor: "Dr. Miriam Toea",
    projectTitle: "MarketLink PNG — Direct Farmer-to-Buyer Marketplace",
    theme: "AgriTech and Food Security",
    sdg: ["SDG_2", "SDG_8", "SDG_9"],
    problemStatement: p(
      "Smallholder farmers in the Highlands sell through a chain of three to four middlemen before produce reaches Lae or Port Moresby markets. Each hand-off adds cost without adding value, and the farmer typically captures under 30% of the final retail price.",
      "Farmers also have no reliable price signal. Without knowing the going rate in the destination market, they accept whatever the first buyer offers at the roadside.",
    ),
    proposedSolution: p(
      "MarketLink PNG is a mobile-first marketplace that lets a farmer list a harvest lot with quantity, grade and pickup location, and lets registered buyers bid on it directly.",
      "The platform works over USSD as well as a smartphone app, because network coverage in the Highlands is uneven and many growers carry feature phones.",
    ),
    innovation: p(
      "The novelty is the USSD-first design paired with a lightweight escrow. Existing marketplaces assume a smartphone and a bank account; MarketLink settles through mobile money and confirms delivery with a one-time code the buyer reads out at pickup.",
    ),
    objectives: ul(
      "Onboard 500 smallholder farmers across three Highlands districts in year one.",
      "Raise the farmer's share of final retail price from roughly 30% to above 55%.",
      "Publish a daily reference price for eight staple crops.",
      "Settle 90% of transactions within 48 hours of delivery confirmation.",
    ),
    targetUsers: p(
      "Smallholder coffee, sweet potato and vegetable growers in Eastern Highlands, Jiwaka and Western Highlands; produce buyers and wholesalers in Lae and Port Moresby; and transport operators who currently run half-empty on return legs.",
    ),
    expectedImpact: p(
      "A grower moving 200kg of sweet potato per week would gain roughly K180 per week under the modelled price share — enough to cover school fees for two children over a term.",
      "Reduced spoilage is a second effect: matching a lot to a buyer before harvest shortens the time produce sits at the roadside.",
    ),
    sustainability: p(
      "Revenue comes from a 3% commission on settled transactions, which covers hosting and support at approximately 1,200 monthly transactions. The team has modelled break-even at month 14.",
    ),
    timeline: ul(
      "Months 1–2: field validation with 40 farmers, USSD prototype.",
      "Months 3–5: pilot in Eastern Highlands with two buyers.",
      "Months 6–9: mobile money integration and escrow.",
      "Months 10–12: expand to Jiwaka and Western Highlands.",
    ),
    prototypeType: "Mobile Application",
    prototypeFeatures: ul(
      "Farmer listing flow over USSD and Android.",
      "Buyer bidding and lot reservation.",
      "Daily reference price board by crop and market.",
      "Delivery confirmation via one-time code.",
      "Mobile money settlement (sandbox).",
    ),
    developmentTools: p(
      "React Native and Expo for the Android client, Node.js and PostgreSQL on the server, Africa's Talking for the USSD gateway, and a sandbox integration with a local mobile money provider.",
    ),
    alternatives: p(
      "<strong>1. Facebook Marketplace groups.</strong> Widely used but unstructured — no grading, no price history, and no protection against a buyer who does not turn up.",
      "<strong>2. Fresh Produce Development Agency depots.</strong> Reliable but sparse; a grower may travel four hours to reach one, which rules out perishables.",
      "<strong>3. Existing agri-apps built for East Africa.</strong> Functionally close, but they assume smartphone penetration and banking rails that do not match PNG conditions.",
    ),
    justification: p(
      "MarketLink is the only one of the four that works on a feature phone, settles through mobile money rather than a bank account, and gives the farmer a price reference before the sale is agreed. Those three together are what move the farmer's bargaining position.",
    ),
    valueProposition: p(
      "The grower gets a larger share of the retail price and a price they can check before selling. The buyer gets graded, traceable supply and fewer failed pickups. The transport operator gets a fuller truck.",
    ),
    implementationPlan: p(
      "A three-district pilot funded by the challenge grant, run alongside the Eastern Highlands provincial agriculture office, followed by a commission-funded expansion.",
    ),
    budget: 48500,
    members: [
      { studentId: "25530062", firstName: "Anna", surname: "Wari", sectionCode: "ACC", role: "Financial Modelling" },
      { studentId: "25530063", firstName: "Peter", surname: "Silas", sectionCode: "IT", role: "Backend Developer" },
      { studentId: "25530064", firstName: "Grace", surname: "Manu", sectionCode: "MGT", role: "Field Research Lead" },
    ],
  },
  {
    studentId: "24410155",
    firstName: "Naomi",
    surname: "Bilong",
    emailLocal: "24410155naomi",
    phone: "+675 7234 5678",
    schoolCode: "SBS",
    sectionCode: "ACC",
    program: "Bachelor of Business (Accounting)",
    yearLevel: YearLevel.YEAR_4,
    status: ApplicationStatus.APPROVED,
    teamName: "Ledger Lae",
    supervisor: "Mr. Samuel Kepas",
    projectTitle: "SME BooksPNG — Offline-First Bookkeeping for Small Traders",
    theme: "FinTech and Financial Inclusion",
    sdg: ["SDG_8", "SDG_9", "SDG_1"],
    problemStatement: p(
      "Roughly four in five small traders in Lae keep records on paper or not at all. When they apply for a loan, the bank asks for twelve months of statements they cannot produce, and the application stops there.",
      "Off-the-shelf accounting software assumes constant internet and monthly subscriptions in kina amounts these businesses will not commit to.",
    ),
    proposedSolution: p(
      "SME BooksPNG is an offline-first Android bookkeeping app. Entries are recorded locally and sync when the device next sees a connection. It produces a bank-ready trading summary and cash-flow statement in one tap.",
    ),
    innovation: p(
      "Rather than replicating a full general ledger, the app models the six transaction types these traders actually use and generates the formal statements from them. The trader never sees a chart of accounts.",
    ),
    objectives: ul(
      "Give 300 traders twelve months of continuous records within the first year.",
      "Cut the time to produce a loan-ready statement from days to minutes.",
      "Achieve usable operation on devices with 1GB RAM and intermittent connectivity.",
    ),
    targetUsers: p("Trade-store owners, market vendors, PMV operators and tailoring businesses in Lae and Morobe Province."),
    expectedImpact: p(
      "Access to credit is the binding constraint for these businesses. Producing verifiable records is the cheapest lever available to shift it.",
    ),
    sustainability: p("A one-off K35 licence with free updates, sold through the same wholesalers these traders already buy stock from."),
    timeline: ul(
      "Months 1–3: build and test the offline ledger core.",
      "Months 4–6: pilot with 40 traders in Lae market.",
      "Months 7–12: statement templates agreed with two commercial banks.",
    ),
    prototypeType: "Mobile Application",
    prototypeFeatures: ul(
      "Offline transaction capture with automatic sync.",
      "Six guided entry types (sale, purchase, expense, wage, loan, drawing).",
      "One-tap trading summary and cash-flow statement.",
      "PDF export for bank submission.",
    ),
    developmentTools: p("Kotlin with Room for local storage, a Supabase backend for sync, and jsPDF for statement export."),
    alternatives: p(
      "<strong>1. QuickBooks / Xero.</strong> Capable but subscription-priced and internet-dependent.",
      "<strong>2. Paper cash books.</strong> Free and familiar, but not accepted as loan evidence and easily lost.",
      "<strong>3. Spreadsheet templates.</strong> Require a computer and a level of spreadsheet skill these traders do not have.",
    ),
    justification: p(
      "SME BooksPNG is the only option that works without a connection, costs a single small payment, and produces output a PNG bank will accept.",
    ),
    valueProposition: p("It converts informal trading activity into the documentation that unlocks formal credit."),
    implementationPlan: p("Pilot with the Lae Chamber of Commerce, then distribute through wholesale suppliers."),
    budget: 32000,
    members: [
      { studentId: "24410156", firstName: "David", surname: "Aigilo", sectionCode: "IT", role: "Android Developer" },
      { studentId: "24410157", firstName: "Ruth", surname: "Kama", sectionCode: "ACC", role: "Accounting Standards" },
    ],
  },
  {
    studentId: "25120088",
    firstName: "Michael",
    surname: "Popuna",
    emailLocal: "25120088michael",
    phone: "+675 7345 6789",
    schoolCode: "SAS",
    sectionCode: "MCS",
    program: "Bachelor of Science (Computer Science)",
    yearLevel: YearLevel.YEAR_2,
    status: ApplicationStatus.UNDER_REVIEW,
    teamName: "Reef Guard",
    projectTitle: "ReefWatch — Community Coral Monitoring with Low-Cost Imaging",
    theme: "Climate, Energy and Environment",
    sdg: ["SDG_14", "SDG_13", "SDG_11"],
    problemStatement: p(
      "Coastal communities in Morobe manage their own reef tenure but have no way to measure whether a closure is working. Formal surveys happen every few years at best and cost more than a community can raise.",
    ),
    proposedSolution: p(
      "ReefWatch pairs a waterproofed phone housing with an image-classification model that estimates live coral cover from short transect videos a community member records while snorkelling.",
    ),
    innovation: p(
      "The classifier is trained on PNG reef imagery rather than Caribbean or Great Barrier Reef datasets, and it runs on-device so that no upload is needed at the point of capture.",
    ),
    objectives: ul(
      "Achieve within 10% agreement with a diver-led point-intercept survey.",
      "Train members of six communities to run quarterly transects.",
      "Publish a provincial reef-health dashboard.",
    ),
    targetUsers: p("Coastal communities with customary reef tenure, provincial fisheries officers, and conservation NGOs."),
    expectedImpact: p("Communities gain evidence for their own management decisions instead of waiting on outside surveys."),
    sustainability: p("Housings are made locally from stock parts; the software is open source with NGO-funded maintenance."),
    timeline: ul(
      "Months 1–4: dataset collection and model training.",
      "Months 5–8: housing design and field trial.",
      "Months 9–12: community training programme.",
    ),
    prototypeType: "Mobile Application",
    prototypeFeatures: ul(
      "On-device coral cover estimation from video.",
      "GPS-tagged transect recording.",
      "Offline queue with sync on return to coverage.",
      "Provincial dashboard.",
    ),
    developmentTools: p("Flutter, TensorFlow Lite, and a Python training pipeline. Housing prototyped with 3D printing."),
    alternatives: p(
      "<strong>1. Diver-led point-intercept surveys.</strong> The scientific standard, but slow and expensive.",
      "<strong>2. Satellite reef monitoring.</strong> Useful at scale but far too coarse for a single village reef.",
      "<strong>3. CoralNet manual annotation.</strong> Accurate but needs a trained annotator and a desktop.",
    ),
    justification: p("ReefWatch is the only approach a community can run itself, at a cost it can sustain, at the spatial scale its decisions are made at."),
    valueProposition: p("It puts reef monitoring in the hands of the people who own the reef."),
    implementationPlan: p("Partner with the Morobe provincial fisheries office and two coastal LLGs for the first year."),
    budget: 27500,
    members: [
      { studentId: "25120089", firstName: "Sarah", surname: "Yandu", sectionCode: "MCS", role: "Machine Learning" },
      { studentId: "25120090", firstName: "John", surname: "Bala", sectionCode: "MEC", role: "Housing Design" },
      { studentId: "25120091", firstName: "Elizabeth", surname: "Tau", sectionCode: "FMS", role: "Marine Science Advisor" },
    ],
  },
  {
    studentId: "24330210",
    firstName: "Priscilla",
    surname: "Nime",
    emailLocal: "24330210priscilla",
    phone: "+675 7456 7890",
    schoolCode: "SBS",
    sectionCode: "AEC",
    program: "Bachelor of Business (Applied Economics)",
    yearLevel: YearLevel.YEAR_3,
    status: ApplicationStatus.REVISION_REQUESTED,
    teamName: "Wantok Health",
    projectTitle: "ClinicQueue — Appointment and Triage Scheduling for Rural Health Posts",
    theme: "Health and Well-being Technology",
    sdg: ["SDG_3", "SDG_10"],
    problemStatement: p(
      "Patients at rural health posts routinely wait a full day, and many walk two hours to find the post closed or the health worker away on outreach.",
    ),
    proposedSolution: p(
      "ClinicQueue is an SMS scheduling and triage tool. Patients text a short code to request a slot and receive a confirmed time plus notice if the post is closed.",
    ),
    innovation: p("Triage priority is set by the health worker from a simple symptom code, so urgent cases are pulled forward rather than queued first-come."),
    objectives: ul("Cut average waiting time by half at four pilot posts.", "Eliminate wasted journeys to closed posts."),
    targetUsers: p("Patients and community health workers at rural health posts in Morobe Province."),
    expectedImpact: p("Shorter waits and fewer wasted journeys raise attendance, particularly for antenatal visits."),
    sustainability: p("Operating cost is SMS traffic only; the team is seeking a zero-rated short code from a carrier."),
    timeline: ul("Months 1–3: build and test.", "Months 4–8: four-post pilot.", "Months 9–12: evaluation."),
    prototypeType: "Digital Tool / Utility",
    prototypeFeatures: ul("SMS slot booking.", "Health-worker triage console.", "Closure broadcast.", "Attendance reporting."),
    developmentTools: p("Node.js, PostgreSQL, and an SMS gateway integration."),
    alternatives: p(
      "<strong>1. Paper appointment books.</strong> In use today; no way to notify a patient of a closure.",
      "<strong>2. Smartphone booking apps.</strong> Assume a smartphone and data the patient population largely does not have.",
      "<strong>3. Radio announcements.</strong> Reach is good but they cannot confirm an individual slot.",
    ),
    justification: p("SMS is the only channel with near-universal reach in the target population."),
    valueProposition: p("Fewer wasted journeys and shorter waits for the patients least able to absorb either."),
    implementationPlan: p("Work through the provincial health authority to pilot at four posts."),
    members: [
      { studentId: "24330211", firstName: "Thomas", surname: "Wai", sectionCode: "IT", role: "Developer" },
      { studentId: "24330212", firstName: "Mary", surname: "Kondo", sectionCode: "AEC", role: "Impact Evaluation" },
    ],
  },
  {
    studentId: "25220134",
    firstName: "Benjamin",
    surname: "Aire",
    emailLocal: "25220134benjamin",
    phone: "+675 7567 8901",
    schoolCode: "SOE",
    sectionCode: "ELC",
    program: "Bachelor of Engineering (Electrical & Communication)",
    yearLevel: YearLevel.YEAR_4,
    status: ApplicationStatus.DRAFT,
    teamName: "Solar Wantok",
    projectTitle: "PowerShare — Pay-As-You-Go Solar for Off-Grid Households",
    theme: "Climate, Energy and Environment",
    sdg: ["SDG_7", "SDG_1", "SDG_13"],
    problemStatement: p(
      "An off-grid household spends K15 to K25 a week on kerosene and phone charging — more over two years than a solar home system costs, but the up-front price is out of reach.",
    ),
    proposedSolution: p(
      "PowerShare supplies a solar home system unlocked by mobile-money top-ups, with ownership transferring after 24 months of payments.",
    ),
    innovation: p("The controller unlocks offline using a signed code the customer types in, so no GSM module is needed in the unit."),
    objectives: ul("Install 250 systems in the first year.", "Keep default rates under 8%."),
    targetUsers: p("Off-grid households in Morobe and Madang provinces."),
    expectedImpact: p("Households swap a recurring kerosene cost for an asset they end up owning."),
    sustainability: p("Payments fund both operations and the next batch of hardware."),
    timeline: ul("Months 1–4: controller firmware.", "Months 5–9: 30-household pilot.", "Months 10–12: scale-up."),
    prototypeType: "Hardware / IoT Device",
    prototypeFeatures: ul("Offline unlock-code validation.", "Usage metering.", "Low-battery warning.", "Agent top-up app."),
    developmentTools: p("ESP32 firmware in C, a React agent application, and a Node.js code-signing service."),
    alternatives: p(
      "<strong>1. Outright purchase of a solar kit.</strong> Cheapest overall but unaffordable up front.",
      "<strong>2. GSM-connected PAYG units.</strong> Proven internationally but need coverage the target areas lack.",
      "<strong>3. Grid extension.</strong> The long-term answer, but decades away for these communities.",
    ),
    justification: p("Offline unlock codes make PAYG work where there is no mobile coverage — which is exactly where off-grid households are."),
    valueProposition: p("Light and phone charging at a weekly cost below what the household already spends on kerosene."),
    implementationPlan: p("Recruit village-based agents for top-ups and first-line maintenance."),
    budget: 65000,
    members: [
      { studentId: "25220135", firstName: "Joseph", surname: "Kaia", sectionCode: "ELC", role: "Firmware" },
      { studentId: "25220136", firstName: "Rachel", surname: "Sine", sectionCode: "MGT", role: "Agent Network" },
    ],
  },
  {
    studentId: "24550301",
    firstName: "Esther",
    surname: "Waim",
    emailLocal: "24550301esther",
    phone: "+675 7678 9012",
    schoolCode: "SBS",
    sectionCode: "MGT",
    program: "Bachelor of Business (Management)",
    yearLevel: YearLevel.YEAR_2,
    status: ApplicationStatus.REJECTED,
    teamName: "Skills Bridge",
    projectTitle: "TradeMatch — Connecting Informal Tradespeople to Verified Work",
    theme: "Digital Innovation for Business",
    sdg: ["SDG_8", "SDG_4"],
    problemStatement: p(
      "Skilled tradespeople outside the formal sector find work through word of mouth, and customers have no way to check competence or past work.",
    ),
    proposedSolution: p("TradeMatch lists tradespeople with verified qualifications and rated job history, and matches them to nearby jobs."),
    innovation: p("Verification runs through the trade training institutions directly rather than relying on self-reported credentials."),
    objectives: ul("List 400 verified tradespeople in Lae.", "Broker 1,000 completed jobs in year one."),
    targetUsers: p("Carpenters, electricians, plumbers and mechanics, and the households and small businesses that hire them."),
    expectedImpact: p("More consistent work for tradespeople and less risk for customers."),
    sustainability: p("A 5% commission on brokered jobs."),
    timeline: ul("Months 1–4: build.", "Months 5–12: Lae rollout."),
    prototypeType: "Web Application",
    prototypeFeatures: ul("Verified trade profiles.", "Job posting and matching.", "Ratings.", "In-app messaging."),
    developmentTools: p("Next.js, PostgreSQL and Supabase."),
    alternatives: p(
      "<strong>1. Facebook community groups.</strong> Free and busy, but no verification of any kind.",
      "<strong>2. Classified listings.</strong> Static and unrated.",
      "<strong>3. Word of mouth.</strong> Trusted but slow and limited to one's own network.",
    ),
    justification: p("Institution-backed verification is the piece none of the alternatives provide."),
    valueProposition: p("Trust, made checkable."),
    implementationPlan: p("Sign agreements with two trade training institutions, then open registration in Lae."),
    members: [{ studentId: "24550302", firstName: "Paul", surname: "Gena", sectionCode: "IT", role: "Developer" }],
  },
  {
    studentId: "25640077",
    firstName: "Cynthia",
    surname: "Lohia",
    emailLocal: "25640077cynthia",
    phone: "+675 7789 0123",
    schoolCode: "SNR",
    sectionCode: "AGR",
    program: "Bachelor of Agriculture",
    yearLevel: YearLevel.YEAR_3,
    status: ApplicationStatus.SUBMITTED,
    teamName: "Green Harvest",
    supervisor: "Dr. Anton Belas",
    projectTitle: "CropDoc PNG — Offline Plant Disease Identification",
    theme: "AgriTech and Food Security",
    sdg: ["SDG_2", "SDG_15"],
    problemStatement: p(
      "Coffee rust and taro blight can take a season's crop before a grower identifies them. Extension officers are stretched across whole districts, and a diagnosis often arrives weeks after it would have been useful.",
    ),
    proposedSolution: p("CropDoc identifies the twelve most common diseases affecting PNG staples from a photograph, entirely on-device, and recommends locally available treatments."),
    innovation: p("Treatment advice is restricted to inputs actually stocked by PNG agricultural suppliers, so the recommendation is one the grower can act on."),
    objectives: ul("Reach 85% top-1 accuracy across the twelve target diseases.", "Reach 2,000 growers in the first year."),
    targetUsers: p("Coffee, taro, sweet potato and banana growers, and district extension officers."),
    expectedImpact: p("Earlier detection reduces crop loss; the team's field estimate is a 20–30% reduction where treatment starts within a week of onset."),
    sustainability: p("Free to growers; funded through the coffee industry corporation and agricultural supplier sponsorship."),
    timeline: ul("Months 1–5: image dataset and model.", "Months 6–9: field validation.", "Months 10–12: release and extension training."),
    prototypeType: "Mobile Application",
    prototypeFeatures: ul("On-device disease identification.", "Locally-stocked treatment recommendations.", "Offline field guide.", "Outbreak reporting to extension officers."),
    developmentTools: p("Flutter, TensorFlow Lite, and a Python training pipeline over a locally collected dataset."),
    alternatives: p(
      "<strong>1. PlantVillage Nuru.</strong> Strong model, but trained on African crop varieties and disease presentations.",
      "<strong>2. Extension officer visits.</strong> Authoritative but far too thin on the ground.",
      "<strong>3. Printed identification guides.</strong> Cheap and offline, but hard to use for a grower who has not seen the disease before.",
    ),
    justification: p("A locally trained model that names a treatment the grower can actually buy is the difference between a diagnosis and a fix."),
    valueProposition: p("A diagnosis in seconds, in the field, without a connection."),
    implementationPlan: p("Collect the dataset with the Coffee Industry Corporation, validate in three districts, release through extension networks."),
    budget: 41000,
    members: [
      { studentId: "25640078", firstName: "Simon", surname: "Vali", sectionCode: "MCS", role: "Machine Learning" },
      { studentId: "25640079", firstName: "Linda", surname: "Peni", sectionCode: "AGR", role: "Plant Pathology" },
      { studentId: "25640080", firstName: "Andrew", surname: "Kutu", sectionCode: "IT", role: "Mobile Developer" },
      { studentId: "25640081", firstName: "Josephine", surname: "Mala", sectionCode: "MKT", role: "Grower Outreach" },
    ],
  },
];

async function seedDemoData(
  schoolIds: Map<string, string>,
  sectionIds: Map<string, string>,
  adminEmail: string,
) {
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const studentDomain = process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN ?? "student.pnguot.ac.pg";

  let created = 0;
  let sequence = 0;

  for (const demo of DEMO_APPLICATIONS) {
    const email = `${demo.emailLocal}@${studentDomain}`;
    const schoolId = schoolIds.get(demo.schoolCode)!;
    const sectionId = sectionIds.get(`${demo.schoolCode}:${demo.sectionCode}`)!;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${demo.firstName} ${demo.surname}`,
        role: Role.STUDENT,
        studentProfile: {
          create: {
            studentId: demo.studentId,
            firstName: demo.firstName,
            surname: demo.surname,
            phone: demo.phone,
            schoolId,
            sectionId,
            program: demo.program,
            yearLevel: demo.yearLevel,
          },
        },
      },
    });

    const existing = await prisma.application.findFirst({
      where: { ownerId: user.id, challengeYear: CHALLENGE_YEAR, deletedAt: null },
    });
    if (existing) continue;

    const isSubmitted = demo.status !== ApplicationStatus.DRAFT;
    sequence += 1;
    const submittedAt = isSubmitted
      ? new Date(Date.now() - sequence * 36 * 60 * 60 * 1000)
      : null;
    const isDecided =
      demo.status === ApplicationStatus.APPROVED || demo.status === ApplicationStatus.REJECTED;

    const application = await prisma.application.create({
      data: {
        ownerId: user.id,
        challengeYear: CHALLENGE_YEAR,
        status: demo.status,
        referenceNumber: isSubmitted
          ? `DBTC-${CHALLENGE_YEAR}-${String(sequence).padStart(4, "0")}`
          : null,
        submittedAt,
        reviewedAt: isDecided ? new Date(Date.now() - sequence * 12 * 60 * 60 * 1000) : null,
        reviewedById: isDecided ? admin?.id : null,
        decisionNote: isDecided
          ? demo.status === ApplicationStatus.APPROVED
            ? "Strong problem framing and a prototype that demonstrably works offline. Accepted."
            : "The verification mechanism is not yet specified in enough detail to assess feasibility."
          : null,
        applicantPhone: demo.phone,
        schoolId,
        sectionId,
        program: demo.program,
        yearLevel: demo.yearLevel,
        projectTitle: demo.projectTitle,
        theme: demo.theme,
        sdgAlignment: demo.sdg,
        problemStatement: demo.problemStatement,
        proposedSolution: demo.proposedSolution,
        innovation: demo.innovation,
        objectives: demo.objectives,
        targetUsers: demo.targetUsers,
        expectedImpact: demo.expectedImpact,
        sustainability: demo.sustainability,
        budgetAmount: demo.budget ?? null,
        timeline: demo.timeline,
        prototypeType: demo.prototypeType,
        prototypeFeatures: demo.prototypeFeatures,
        developmentTools: demo.developmentTools,
        alternatives: demo.alternatives,
        justification: demo.justification,
        valueProposition: demo.valueProposition,
        implementationPlan: demo.implementationPlan,
        team: {
          create: {
            name: demo.teamName,
            leaderName: `${demo.firstName} ${demo.surname}`,
            leaderStudentId: demo.studentId,
            leaderEmail: email,
            leaderPhone: demo.phone,
            supervisorName: demo.supervisor ?? null,
            members: {
              create: [
                {
                  studentId: demo.studentId,
                  firstName: demo.firstName,
                  surname: demo.surname,
                  sectionId,
                  role: "Team Leader",
                  email,
                  phone: demo.phone,
                  isLeader: true,
                  sortOrder: 0,
                },
                ...demo.members.map((member, index) => ({
                  studentId: member.studentId,
                  firstName: member.firstName,
                  surname: member.surname,
                  sectionId: sectionIds.get(`${demo.schoolCode}:${member.sectionCode}`) ?? null,
                  role: member.role,
                  isLeader: false,
                  sortOrder: index + 1,
                })),
              ],
            },
          },
        },
        declaration: isSubmitted
          ? {
              create: {
                mode: DeclarationMode.ELECTRONIC,
                accepted: true,
                signatoryName: `${demo.firstName} ${demo.surname}`,
                signedAt: submittedAt,
                ipAddress: "203.0.113.10",
                userAgent: "Seed script",
              },
            }
          : undefined,
      },
    });

    // Status trail
    const trail: Array<{ from: ApplicationStatus | null; to: ApplicationStatus; note?: string }> = [
      { from: null, to: ApplicationStatus.DRAFT, note: "Application started." },
    ];
    if (isSubmitted) trail.push({ from: ApplicationStatus.DRAFT, to: ApplicationStatus.SUBMITTED, note: "Submitted for review." });
    if (demo.status === ApplicationStatus.UNDER_REVIEW || isDecided) {
      trail.push({ from: ApplicationStatus.SUBMITTED, to: ApplicationStatus.UNDER_REVIEW, note: "Picked up by the review panel." });
    }
    if (demo.status === ApplicationStatus.REVISION_REQUESTED) {
      trail.push({
        from: ApplicationStatus.SUBMITTED,
        to: ApplicationStatus.REVISION_REQUESTED,
        note: "Please quantify the expected reduction in waiting time and name the SMS carrier you have approached.",
      });
    }
    if (isDecided) {
      trail.push({ from: ApplicationStatus.UNDER_REVIEW, to: demo.status, note: application.decisionNote ?? undefined });
    }

    for (const [index, step] of trail.entries()) {
      await prisma.statusHistory.create({
        data: {
          applicationId: application.id,
          fromStatus: step.from,
          toStatus: step.to,
          actorId: index === 0 || step.to === ApplicationStatus.SUBMITTED ? user.id : admin?.id,
          note: step.note,
          createdAt: new Date(Date.now() - (trail.length - index) * 20 * 60 * 60 * 1000),
        },
      });
    }

    if (demo.status === ApplicationStatus.REVISION_REQUESTED && admin) {
      await prisma.comment.create({
        data: {
          applicationId: application.id,
          authorId: admin.id,
          visibility: CommentVisibility.SHARED,
          body: "Section on expected impact needs a measurable target. Please also confirm which carrier will provide the short code.",
        },
      });
      await prisma.comment.create({
        data: {
          applicationId: application.id,
          authorId: admin.id,
          visibility: CommentVisibility.INTERNAL,
          body: "Good problem selection. Hold at revision until the carrier question is answered.",
        },
      });
    }

    if (isSubmitted) {
      await prisma.attachment.create({
        data: {
          applicationId: application.id,
          kind: AttachmentKind.SUPPORTING_DOCUMENT,
          fileName: "prototype-walkthrough.pdf",
          storagePath: `${application.id}/seed-prototype-walkthrough.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 842_113,
          uploadedById: user.id,
        },
      });
    }

    created += 1;
  }

  console.log(`  demo applications: ${created}`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding PNGUoT Student Challenge portal…");

  console.log("- reference data");
  const { schoolIds, sectionIds } = await seedReferenceData();

  console.log("- settings");
  await seedSettings();

  console.log("- administrators");
  const admins = await seedAdministrators();

  if (process.env.NODE_ENV === "production") {
    console.log("- demo data skipped (NODE_ENV=production)");
  } else {
    console.log("- demo data");
    await seedDemoData(schoolIds, sectionIds, admins[0]);
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
