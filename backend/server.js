require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));

// STUDENT MODEL
const Student = mongoose.model("Student", new mongoose.Schema({
    name: String,
    college: String,
    phone: String,
    email: String
}, { timestamps: true }));

// APPLICATION MODEL
const Application = mongoose.model("Application", new mongoose.Schema({
    name: String,
    college: String,
    from: String,
    to: String,
    status: {
        type: String,
        default: "Pending"
    },
    passId: String,
    validFrom: Date,
    validUntil: Date
}, { timestamps: true }));

// COMPLAINT MODEL
const Complaint = mongoose.model("Complaint", new mongoose.Schema({
    id: String,
    name: String,
    type: String,
    bus: String,
    description: String,
    status: {
        type: String,
        default: "Pending"
    },
    adminResponse: {
        type: String,
        default: ""
    }
}, { timestamps: true }));

// REGISTER STUDENT
app.post("/api/students", async (req, res) => {
    try {
        const student = await Student.create(req.body);

        res.json({
            message: "Registration successful!",
            student
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET STUDENTS
app.get("/api/students", async (req, res) => {
    try {
        const students = await Student.find();
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// APPLY CONCESSION
app.post("/api/applications", async (req, res) => {
    try {
        const application = await Application.create(req.body);

        res.json({
            message: "Application submitted!",
            application
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET APPLICATIONS
app.get("/api/applications", async (req, res) => {
    try {
        const applications = await Application.find();
        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE APPLICATION STATUS
app.patch("/api/applications/:id/status", async (req, res) => {
    try {
        const { status } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({
                message: "Invalid application status."
            });
        }

        const application = await Application.findById(
            req.params.id
        );

        if (!application) {
            return res.status(404).json({
                message: "Application not found."
            });
        }

        application.status = status;

        if (status === "Approved") {
            if (!application.passId) {
                application.passId =
                    "SSBS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
            }

            application.validFrom = new Date();

            application.validUntil = new Date(
                Date.now() + 180 * 24 * 60 * 60 * 1000
            );
        }

        if (status === "Rejected") {
            application.passId = undefined;
            application.validFrom = undefined;
            application.validUntil = undefined;
        }

        await application.save();

        res.json({
            message: "Application updated successfully!",
            application
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ADD COMPLAINT
app.post("/api/complaints", async (req, res) => {
    try {
        const complaint = await Complaint.create(req.body);

        res.json({
            message: "Complaint submitted!",
            complaint
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET COMPLAINTS
app.get("/api/complaints", async (req, res) => {
    try {
        const complaints = await Complaint.find();
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// UPDATE COMPLAINT STATUS AND ADMIN RESPONSE
app.patch("/api/complaints/:id/status", async (req, res) => {
    try {
        const { status, adminResponse } = req.body;

        if (status && !["Pending", "Resolved"].includes(status)) {
            return res.status(400).json({
                message: "Invalid complaint status."
            });
        }

        const complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
                {
                  ...(status ? { status } : {}),
                  ...(adminResponse !== undefined ? { adminResponse } : {})
                },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found."
            });
        }

        res.json({
            message: "Complaint updated successfully!",
            complaint
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// HOME PAGE
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../frontend/index.html")
    );
});

// CONNECT MONGODB AND START SERVER
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected Successfully!");

        app.listen(PORT, () => {
            console.log("Server running on port " + PORT);
        });
    })
    .catch((error) => {
        console.log("MongoDB Connection Error:", error.message);
    });
