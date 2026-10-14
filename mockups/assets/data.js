/* Sample data for the mockups. Illustrative only — names, tickets and patches are fictional. */
window.PITS = (function () {
  const users = {
    u1: { id: "u1", name: "Mona Adel", initials: "MA", org: "Port", roles: ["Application Support"], color: "#2878E3", email: "mona.adel@port.local", active: true },
    u2: { id: "u2", name: "Omar Hassan", initials: "OH", org: "Port", roles: ["Application Manager", "System Administrator"], color: "#14283F", email: "omar.hassan@port.local", active: true },
    u3: { id: "u3", name: "Karim Fathy", initials: "KF", org: "Solutions Co.", roles: ["Developer"], color: "#6D4FD8", email: "karim.fathy@solutions.local", active: true },
    u4: { id: "u4", name: "Sara Nabil", initials: "SN", org: "Solutions Co.", roles: ["Developer"], color: "#A1479E", email: "sara.nabil@solutions.local", active: true },
    u5: { id: "u5", name: "Youssef Samir", initials: "YS", org: "Port", roles: ["Tester"], color: "#0F8A80", email: "youssef.samir@port.local", active: true },
    u6: { id: "u6", name: "Laila Ibrahim", initials: "LI", org: "Solutions Co.", roles: ["Tester", "Developer"], color: "#B7791F", email: "laila.ibrahim@solutions.local", active: true },
    u7: { id: "u7", name: "Hany Mostafa", initials: "HM", org: "Port", roles: ["Integration"], color: "#0B7FA8", email: "hany.mostafa@port.local", active: true },
    u8: { id: "u8", name: "Nour Khaled", initials: "NK", org: "Solutions Co.", roles: ["Developer"], color: "#D9572A", email: "nour.khaled@solutions.local", active: true },
    u9: { id: "u9", name: "Tarek Mansour", initials: "TM", org: "Port", roles: ["System Administrator"], color: "#3B4F66", email: "tarek.mansour@port.local", active: false }
  };

  const me = "u2";

  const modules = [
    { id: "billing", name: "Billing", active: true },
    { id: "manifest", name: "Manifest", active: true },
    { id: "warehousing", name: "Warehousing", active: true },
    { id: "shipvisits", name: "Ship Visits", active: true },
    { id: "gate", name: "Gate Operations", active: true },
    { id: "integration", name: "Integration", active: true }
  ];

  const statuses = {
    open: "Open",
    progress: "In Progress",
    review: "Code Review",
    testing: "Testing",
    ready: "Ready for Deployment",
    deployed: "Deployed",
    verify: "Production Verification",
    closed: "Closed",
    blocked: "Blocked"
  };
  const workflow = ["open", "progress", "review", "testing", "ready", "deployed", "verify", "closed"];
  const priorities = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  const types = { bug: "Bug", cr: "Change Request" };
  const envs = { prod: "Production", test: "Testing" };

  const tickets = [
    {
      id: 1042, type: "bug", priority: "critical", status: "progress", module: "Billing", env: "prod",
      title: "Storage invoice doubles reefer plug-in charges after midnight cutover",
      desc: "Reefer containers that stay plugged in across the 00:00 billing cutover are charged for both calendar days at the full daily rate. Seen on 14 invoices since Oct 9.",
      creator: "u1", created: "2026-10-12T09:14", assignedBy: "u2", assignee: "u3", collaborators: ["u8"], reviewer: "u4", tester: "u5", contributors: ["u3", "u8"],
      patch: "PATCH-2026.10.3", related: [1029]
    },
    {
      id: 1041, type: "cr", priority: "high", status: "testing", module: "Manifest", env: "test",
      title: "Allow amending container weight on submitted manifests before vessel arrival",
      desc: "Agents need to correct VGM weights after submission without cancelling the whole manifest. Amendments should keep an audit trail.",
      creator: "u7", created: "2026-10-10T13:40", assignedBy: "u2", assignee: "u4", collaborators: [], reviewer: "u3", tester: "u6", contributors: ["u4"],
      patch: "PATCH-2026.10.2", related: []
    },
    {
      id: 1040, type: "bug", priority: "high", status: "blocked", module: "Gate Operations", env: "prod", ar: true,
      title: "البوابة ٣ لا تقرأ أرقام الحاويات من كاميرات OCR بعد التحديث الأخير",
      desc: "منذ تحديث يوم الأحد، تظهر أرقام الحاويات فارغة في شاشة البوابة ٣ ويضطر الموظف لإدخالها يدويًا، مما يؤخر خروج الشاحنات.",
      creator: "u1", created: "2026-10-11T07:55", assignedBy: "u2", assignee: "u8", collaborators: ["u7"], reviewer: "u3", tester: "u5", contributors: ["u8"],
      patch: null, related: [1037], blockedBy: "TKT-1037"
    },
    {
      id: 1039, type: "bug", priority: "medium", status: "review", module: "Warehousing", env: "test",
      title: "Yard location search times out for blocks with more than 2,000 slots",
      desc: "Searching block Y7 or Y8 by container number spins for 30s and returns a gateway timeout. Smaller blocks respond instantly.",
      creator: "u5", created: "2026-10-09T11:20", assignedBy: "u2", assignee: "u3", collaborators: [], reviewer: "u4", tester: "u6", contributors: ["u3"],
      patch: "PATCH-2026.10.2", related: []
    },
    {
      id: 1038, type: "cr", priority: "medium", status: "open", module: "Ship Visits", env: "test",
      title: "Add pilot boarding time to the ship visit timeline",
      desc: "Marine operations want pilot boarding and disembarking times recorded next to ATA/ATD so berth planners can see actual pilotage duration.",
      creator: "u2", created: "2026-10-13T08:05", assignedBy: null, assignee: null, collaborators: [], reviewer: null, tester: null, contributors: [],
      patch: null, related: []
    },
    {
      id: 1037, type: "bug", priority: "critical", status: "verify", module: "Integration", env: "prod",
      title: "Customs EDI acknowledgments stuck in the pending queue",
      desc: "CUSRES acknowledgments from customs arrive but are never matched to their declarations, leaving 230 containers on hold.",
      creator: "u7", created: "2026-10-07T16:32", assignedBy: "u2", assignee: "u4", collaborators: ["u3"], reviewer: "u8", tester: "u5", contributors: ["u4"],
      patch: "PATCH-2026.10.1", related: [1040]
    },
    {
      id: 1036, type: "cr", priority: "low", status: "ready", module: "Billing", env: "test", ar: true,
      title: "إضافة الرقم الضريبي للعميل في رأس الفاتورة المطبوعة",
      desc: "طلب من الإدارة المالية لإظهار الرقم الضريبي للعميل أسفل اسمه في الفاتورة المطبوعة وملف PDF.",
      creator: "u1", created: "2026-10-06T10:00", assignedBy: "u2", assignee: "u8", collaborators: [], reviewer: "u3", tester: "u6", contributors: ["u8"],
      patch: "PATCH-2026.10.3", related: []
    },
    {
      id: 1035, type: "bug", priority: "high", status: "deployed", module: "Manifest", env: "prod",
      title: "Hazmat class not carried over when splitting a bill of lading",
      desc: "After splitting a B/L into two, the child B/Ls lose their IMDG class and UN number, so the yard plan places them in general stacks.",
      creator: "u5", created: "2026-10-05T14:47", assignedBy: "u2", assignee: "u3", collaborators: [], reviewer: "u4", tester: "u6", contributors: ["u3"],
      patch: "PATCH-2026.10.1", related: []
    },
    {
      id: 1034, type: "bug", priority: "medium", status: "closed", closure: "resolved", module: "Gate Operations", env: "prod",
      title: "Truck appointment slot shows the wrong time zone on the gate screen",
      desc: "Appointment slots render in UTC on the kiosk while the booking portal shows local time, so drivers arrive two hours early.",
      creator: "u1", created: "2026-09-29T09:30", assignedBy: "u2", assignee: "u8", collaborators: [], reviewer: "u4", tester: "u5", contributors: ["u8"],
      patch: "PATCH-2026.09.4", related: [], closedBy: "u2", closedAt: "2026-10-04T12:10"
    },
    {
      id: 1033, type: "bug", priority: "low", status: "open", module: "Warehousing", env: "test",
      title: "Stock report rounds pallet counts down instead of to the nearest whole",
      desc: "Half pallets are dropped from the daily stock report, so totals disagree with the warehouse floor count.",
      creator: "u5", created: "2026-10-13T12:02", assignedBy: "u2", assignee: "u4", collaborators: [], reviewer: null, tester: null, contributors: [],
      patch: null, related: []
    },
    {
      id: 1032, type: "bug", priority: "high", status: "closed", closure: "unresolved", module: "Integration", env: "prod",
      title: "Port community system sync drops vessel ETA updates",
      desc: "ETA changes sent by shipping lines after 18:00 never reach the berth plan. Production verification failed; follow-up raised as TKT-1029.",
      creator: "u7", created: "2026-09-24T15:15", assignedBy: "u2", assignee: "u4", collaborators: [], reviewer: "u3", tester: "u5", contributors: ["u4"],
      patch: "PATCH-2026.09.3", related: [1029], closedBy: "u2", closedAt: "2026-09-30T10:40"
    },
    {
      id: 1031, type: "cr", priority: "medium", status: "closed", closure: "cancelled", module: "Ship Visits", env: "test",
      title: "Merge berth request and ship visit forms into one screen",
      desc: "Cancelled: superseded by the berth planning redesign scheduled for Q1.",
      creator: "u2", created: "2026-09-20T09:00", assignedBy: "u2", assignee: null, collaborators: [], reviewer: null, tester: null, contributors: [],
      patch: null, related: [], closedBy: "u2", closedAt: "2026-09-22T08:30"
    }
  ];

  return { users, me, modules, statuses, workflow, priorities, types, envs, tickets };
})();
