require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// DATABASE CONNECTION
// ==========================================

if (!MONGO_URI || !JWT_SECRET) {
    console.error("MONGO_URI / MONGODB_URI or JWT_SECRET missing in .env");
    process.exit(1);
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function normalizeCollege(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function createToken(id, role, extra = {}) {
    return jwt.sign(
        { id, role, ...extra },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Please login first"
        });
    }

    try {
        const token = header.split(" ")[1];

        req.user = jwt.verify(token, JWT_SECRET);

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

function allowRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        next();
    };
}

function handleError(res, error) {
    console.error(error);

    if (error.code === 11000) {
        return res.status(409).json({
            message: "This record already exists"
        });
    }

    res.status(500).json({
        message: "Server error"
    });
}

// ==========================================
// STUDENT MODEL
// ==========================================

const studentSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    college: {
        type: String,
        required: true
    },

    collegeKey: {
        type: String,
        required: true
    },

    admissionNumber: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    passwordHash: {
        type: String,
        required: true,
        select: false
    }

}, { timestamps: true });

const Student = mongoose.model("Student", studentSchema);

// ==========================================
// COLLEGE MODEL
// ==========================================

const collegeSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    collegeKey: {
        type: String,
        required: true,
        unique: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    passwordHash: {
        type: String,
        required: true,
        select: false
    },

    status: {
        type: String,
        enum: ["Pending", "Active", "Rejected"],
        default: "Pending"
    }

}, { timestamps: true });

const College = mongoose.model("College", collegeSchema);

// ==========================================
// APPLICATION MODEL
// ==========================================

const applicationSchema = new mongoose.Schema({

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    name: String,

    admissionNumber: String,

    college: String,

    collegeKey: String,

    from: {
        type: String,
        required: true
    },

    to: {
        type: String,
        required: true
    },

    status: {
        type: String,
        default: "Pending College Verification"
    },

    collegeRemarks: String,

    adminRemarks: String,

    verifiedAt: Date,

    verifiedBy: String,

    passId: String,

    validFrom: Date,

    validUntil: Date

}, { timestamps: true });

const Application = mongoose.model(
    "Application",
    applicationSchema
);

// ==========================================
// COMPLAINT MODEL
// ==========================================

const complaintSchema = new mongoose.Schema({

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },

    type: String,

    bus: String,

    description: {
        type: String,
        required: true
    },

    status: {
        type: String,
        default: "Pending"
    },

    adminResponse: String

}, { timestamps: true });

const Complaint = mongoose.model(
    "Complaint",
    complaintSchema
);

// ==========================================
// STUDENT REGISTRATION
// ==========================================

app.post("/api/students", async (req, res) => {
    try {

        const {
            name,
            college,
            admissionNumber,
            phone,
            email,
            password
        } = req.body;

        if (
            !name ||
            !college ||
            !admissionNumber ||
            !phone ||
            !email ||
            !password
        ) {
            return res.status(400).json({
                message: "Please fill all required fields"
            });
        }

        if (String(password).length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters"
            });
        }

        const collegeKey = normalizeCollege(college);
        const normalizedEmail = normalizeEmail(email);

        const activeCollege = await College.findOne({
            collegeKey,
            status: "Active"
        });

        if (!activeCollege) {
            return res.status(400).json({
                message: "College is not registered or approved yet"
            });
        }

        const existingStudent = await Student.findOne({
            email: normalizedEmail
        });

        if (existingStudent) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const student = await Student.create({

            name: name.trim(),

            college: activeCollege.name,

            collegeKey: activeCollege.collegeKey,

            admissionNumber: admissionNumber.trim(),

            phone: phone.trim(),

            email: normalizedEmail,

            passwordHash

        });

        res.status(201).json({
            message: "Student registration successful",
            student: {
                id: student._id,
                name: student.name,
                email: student.email
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// ==========================================
// STUDENT LOGIN
// ==========================================

app.post("/api/students/login", async (req, res) => {
    try {

        const email = normalizeEmail(req.body.email);

        const password = req.body.password;

        const student = await Student.findOne({
            email
        }).select("+passwordHash");

        if (
            !student ||
            !await bcrypt.compare(
                password || "",
                student.passwordHash
            )
        ) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = createToken(
            student._id,
            "student"
        );

        res.json({
            message: "Login successful",
            token,
            student: {
                id: student._id,
                name: student.name,
                email: student.email
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// ==========================================
// GET LOGGED-IN USER
// ==========================================

app.get(
    "/api/me",
    authenticate,
    async (req, res) => {
        try {

            if (req.user.role === "student") {

                const student = await Student.findById(
                    req.user.id
                ).select("-passwordHash");

                if (!student) {
                    return res.status(404).json({
                        message: "Student not found"
                    });
                }

                return res.json({
                    role: "student",
                    user: student,
                    student
                });
            }

            if (req.user.role === "college") {

                const college = await College.findById(
                    req.user.id
                ).select("-passwordHash");

                if (!college) {
                    return res.status(404).json({
                        message: "College not found"
                    });
                }

                return res.json({
                    role: "college",
                    user: college,
                    college
                });
            }

            if (req.user.role === "admin") {

                return res.json({
                    role: "admin",
                    user: {
                        email: process.env.ADMIN_EMAIL
                    }
                });
            }

            res.status(403).json({
                message: "Invalid account"
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// COLLEGE SELF REGISTRATION
// ==========================================

app.post("/api/colleges/register", async (req, res) => {
    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Please fill all required fields"
            });
        }

        if (String(password).length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters"
            });
        }

        const collegeKey = normalizeCollege(name);

        const normalizedEmail = normalizeEmail(email);

        const existingCollege = await College.findOne({
            $or: [
                { email: normalizedEmail },
                { collegeKey }
            ]
        });

        if (existingCollege) {
            return res.status(409).json({
                message: "College or email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(
            password,
            12
        );

        await College.create({

            name: name.trim(),

            collegeKey,

            email: normalizedEmail,

            passwordHash,

            status: "Pending"

        });

        res.status(201).json({
            message: "College registration submitted. Waiting for admin approval."
        });

    } catch (error) {
        handleError(res, error);
    }
});

// ==========================================
// COLLEGE LOGIN
// ==========================================

app.post("/api/colleges/login", async (req, res) => {
    try {

        const email = normalizeEmail(req.body.email);

        const password = req.body.password;

        const college = await College.findOne({
            email
        }).select("+passwordHash");

        if (!college) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (college.status === "Pending") {
            return res.status(403).json({
                message: "Your registration is waiting for admin approval"
            });
        }

        if (college.status === "Rejected") {
            return res.status(403).json({
                message: "College registration was rejected"
            });
        }

        const validPassword = await bcrypt.compare(
            password || "",
            college.passwordHash
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = createToken(
            college._id,
            "college",
            {
                collegeKey: college.collegeKey
            }
        );

        res.json({
            message: "College login successful",
            token,
            college: {
                id: college._id,
                name: college.name
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// ==========================================
// STUDENT APPLY FOR CONCESSION
// ==========================================

app.post(
    "/api/applications",
    authenticate,
    allowRoles("student"),
    async (req, res) => {
        try {

            const { from, to } = req.body;

            if (!from || !to) {
                return res.status(400).json({
                    message: "Enter starting point and destination"
                });
            }

            const student = await Student.findById(
                req.user.id
            );

            if (!student) {
                return res.status(404).json({
                    message: "Student not found"
                });
            }

            const application = await Application.create({

                studentId: student._id,

                name: student.name,

                admissionNumber: student.admissionNumber,

                college: student.college,

                collegeKey: student.collegeKey,

                from: from.trim(),

                to: to.trim(),

                status: "Pending College Verification"

            });

            res.status(201).json({
                message: "Concession application submitted successfully",
                application
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// STUDENT VIEW APPLICATIONS
// ==========================================

app.get(
    "/api/student/applications",
    authenticate,
    allowRoles("student"),
    async (req, res) => {
        try {

            const applications = await Application.find({
                studentId: req.user.id
            }).sort({ createdAt: -1 });

            res.json(applications);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// STUDENT REGISTER COMPLAINT
// ==========================================

app.post(
    "/api/complaints",
    authenticate,
    allowRoles("student"),
    async (req, res) => {
        try {

            const { type, bus, description } = req.body;

            if (!type || !description) {
                return res.status(400).json({
                    message: "Enter complaint details"
                });
            }

            const complaint = await Complaint.create({

                studentId: req.user.id,

                type,

                bus: bus || "",

                description

            });

            res.status(201).json({
                message: "Complaint submitted successfully",
                complaint
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// STUDENT VIEW COMPLAINTS
// ==========================================

app.get(
    "/api/student/complaints",
    authenticate,
    allowRoles("student"),
    async (req, res) => {
        try {

            const complaints = await Complaint.find({
                studentId: req.user.id
            }).sort({ createdAt: -1 });

            res.json(complaints);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// COLLEGE VIEW APPLICATIONS
// ==========================================

app.get(
    "/api/college/applications",
    authenticate,
    allowRoles("college"),
    async (req, res) => {
        try {

            const college = await College.findById(
                req.user.id
            );

            if (!college || college.status === "Rejected" ||
                college.status === "Pending") {
                return res.status(403).json({
                    message: "College account is not active"
                });
            }

            const applications = await Application.find({
                collegeKey: college.collegeKey
            }).sort({ createdAt: -1 });

            res.json(applications);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// COLLEGE VERIFY / REJECT APPLICATION
// ==========================================

app.patch(
    "/api/college/applications/:id/verify",
    authenticate,
    allowRoles("college"),
    async (req, res) => {
        try {

            const { decision, remarks } = req.body;

            if (!["Verified", "Rejected"].includes(decision)) {
                return res.status(400).json({
                    message: "Invalid decision"
                });
            }

            const college = await College.findById(
                req.user.id
            );

            if (!college || college.status === "Pending" ||
                college.status === "Rejected") {
                return res.status(403).json({
                    message: "College account is not active"
                });
            }

            const application = await Application.findOne({
                _id: req.params.id,
                collegeKey: college.collegeKey
            });

            if (!application) {
                return res.status(404).json({
                    message: "Application not found"
                });
            }

            if (
                application.status !==
                "Pending College Verification"
            ) {
                return res.status(400).json({
                    message: "Application already processed"
                });
            }

            application.status =
                decision === "Verified"
                    ? "College Verified"
                    : "Rejected";

            application.collegeRemarks = remarks || "";

            application.verifiedAt = new Date();

            application.verifiedBy = college.name;

            await application.save();

            res.json({
                message: "Application updated successfully",
                application
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN LOGIN
// ==========================================

app.post("/api/admin/login", (req, res) => {

    const email = normalizeEmail(req.body.email);

    const password = req.body.password;

    if (
        !process.env.ADMIN_EMAIL ||
        !process.env.ADMIN_PASSWORD
    ) {
        return res.status(500).json({
            message: "Admin credentials missing in .env"
        });
    }

    if (
        email !== normalizeEmail(process.env.ADMIN_EMAIL) ||
        password !== process.env.ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            message: "Invalid admin email or password"
        });
    }

    const token = createToken("admin", "admin");

    res.json({
        message: "Admin login successful",
        token
    });
});

// ==========================================
// ADMIN VIEW COLLEGES
// ==========================================

app.get(
    "/api/admin/colleges",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const colleges = await College.find()
                .select("-passwordHash")
                .sort({ createdAt: -1 });

            res.json(colleges);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN APPROVE / REJECT COLLEGE
// ==========================================

app.patch(
    "/api/admin/colleges/:id/decision",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const { decision } = req.body;

            if (!["Approved", "Rejected"].includes(decision)) {
                return res.status(400).json({
                    message: "Invalid decision"
                });
            }

            const college = await College.findById(
                req.params.id
            );

            if (!college) {
                return res.status(404).json({
                    message: "College not found"
                });
            }

            if (college.status !== "Pending") {
                return res.status(400).json({
                    message: "College registration already processed"
                });
            }

            college.status =
                decision === "Approved"
                    ? "Active"
                    : "Rejected";

            await college.save();

            res.json({
                message: `College ${decision.toLowerCase()} successfully`,
                college
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN VIEW STUDENTS
// ==========================================

app.get(
    "/api/students",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const students = await Student.find()
                .select("-passwordHash")
                .sort({ createdAt: -1 });

            res.json(students);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN VIEW APPLICATIONS
// ==========================================

app.get(
    "/api/applications",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const applications = await Application.find()
                .sort({ createdAt: -1 });

            res.json(applications);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN FINAL APPLICATION DECISION
// ==========================================

app.patch(
    "/api/admin/applications/:id/decision",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const { decision, remarks } = req.body;

            if (!["Approved", "Rejected"].includes(decision)) {
                return res.status(400).json({
                    message: "Invalid decision"
                });
            }

            const application = await Application.findById(
                req.params.id
            );

            if (!application) {
                return res.status(404).json({
                    message: "Application not found"
                });
            }

            if (application.status !== "College Verified") {
                return res.status(400).json({
                    message: "College verification is required first"
                });
            }

            application.adminRemarks = remarks || "";

            application.status = decision;

            if (decision === "Approved") {

                application.passId =
                    crypto.randomBytes(16).toString("hex");

                application.validFrom = new Date();

                application.validUntil = new Date(
                    Date.now() + 180 * 24 * 60 * 60 * 1000
                );

            } else {

                application.passId = undefined;

                application.validFrom = undefined;

                application.validUntil = undefined;
            }

            await application.save();

            res.json({
                message: `Application ${decision.toLowerCase()} successfully`,
                application
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// QR PASS VERIFICATION
// ==========================================

app.get(
    "/api/passes/:passId",
    async (req, res) => {
        try {

            const application = await Application.findOne({
                passId: req.params.passId,
                status: "Approved"
            });

            if (!application) {
                return res.status(404).json({
                    valid: false,
                    message: "Invalid pass"
                });
            }

            const now = new Date();

            if (
                !application.validFrom ||
                !application.validUntil ||
                now < application.validFrom ||
                now > application.validUntil
            ) {
                return res.status(403).json({
                    valid: false,
                    message: "Pass expired or not yet valid"
                });
            }

            const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

const validDate = new Date(application.validUntil)
    .toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata"
    });

res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Student Bus Pass</title>
    <style>
        body {
            font-family: Arial;
            background: #eef3f9;
            padding: 20px;
        }
        .card {
            max-width: 420px;
            margin: 40px auto;
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 15px #ccc;
        }
        h2 {
            text-align: center;
            color: #123c69;
        }
        .status {
            text-align: center;
            color: green;
            font-weight: bold;
            font-size: 20px;
        }
        p {
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="card">
        <h2>Student Bus Pass</h2>
        <div class="status">✓ VALID PASS</div>

        <p><b>Name:</b> ${escapeHTML(application.name)}</p>
        <p><b>College:</b> ${escapeHTML(application.college)}</p>
        <p><b>From:</b> ${escapeHTML(application.from)}</p>
        <p><b>To:</b> ${escapeHTML(application.to)}</p>
        <p><b>Valid Until:</b> ${escapeHTML(validDate)}</p>
    </div>
</body>
</html>
`);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN VIEW COMPLAINTS
// ==========================================

app.get(
    "/api/complaints",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const complaints = await Complaint.find()
                .populate("studentId", "name email college")
                .sort({ createdAt: -1 });

            res.json(complaints);

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN REPLY / UPDATE COMPLAINT
// ==========================================

app.patch(
    "/api/complaints/:id/status",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const { status, adminResponse } = req.body;

            const allowedStatuses = [
                "Pending",
                "In Progress",
                "Resolved"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    message: "Invalid complaint status"
                });
            }

            const complaint = await Complaint.findById(
                req.params.id
            );

            if (!complaint) {
                return res.status(404).json({
                    message: "Complaint not found"
                });
            }

            complaint.status = status;

            complaint.adminResponse = adminResponse || "";

            await complaint.save();

            res.json({
                message: "Complaint updated successfully",
                complaint
            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// ADMIN DASHBOARD SUMMARY
// ==========================================

app.get(
    "/api/admin/dashboard",
    authenticate,
    allowRoles("admin"),
    async (req, res) => {
        try {

            const totalStudents =
                await Student.countDocuments();

            const totalColleges =
                await College.countDocuments({
                    status: "Active"
                });

            const pendingColleges =
                await College.countDocuments({
                    status: "Pending"
                });

            const totalApplications =
                await Application.countDocuments();

            const pendingApplications =
                await Application.countDocuments({
                    status: "Pending College Verification"
                });

            const verifiedApplications =
                await Application.countDocuments({
                    status: "College Verified"
                });

            const approvedApplications =
                await Application.countDocuments({
                    status: "Approved"
                });

            const rejectedApplications =
                await Application.countDocuments({
                    status: "Rejected"
                });

            const totalComplaints =
                await Complaint.countDocuments();

            const pendingComplaints =
                await Complaint.countDocuments({
                    status: "Pending"
                });

            const resolvedComplaints =
                await Complaint.countDocuments({
                    status: "Resolved"
                });

            res.json({

                totalStudents,

                totalColleges,

                pendingColleges,

                totalApplications,

                pendingApplications,

                verifiedApplications,

                approvedApplications,

                rejectedApplications,

                totalComplaints,

                pendingComplaints,

                resolvedComplaints

            });

        } catch (error) {
            handleError(res, error);
        }
    }
);

// ==========================================
// SERVER START
// ==========================================

mongoose.connect(MONGO_URI)
    .then(() => {

        console.log("MongoDB connected successfully");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    })
    .catch(error => {
        console.error("MongoDB connection error:", error.message);
    });