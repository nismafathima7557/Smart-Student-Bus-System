const API = "/api";

// =====================================
// AUTHENTICATION HELPERS
// =====================================

function getToken(role) {
    return localStorage.getItem(role + "Token");
}

function saveToken(role, token) {
    localStorage.setItem(role + "Token", token);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showMessage(id, message, success = false) {
    const element = document.getElementById(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "green" : "red";
}

function containerMessage(id, message) {
    const element = document.getElementById(id);

    if (element) {
        element.innerHTML = `<p>${escapeHTML(message)}</p>`;
    }
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const response = await fetch(API + endpoint, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

function authHeaders(role) {
    return {
        Authorization: "Bearer " + getToken(role)
    };
}

// =====================================
// PAGE NAVIGATION AND FORM CLEARING
// =====================================

function clearPageForms(pageId) {
    const page = document.getElementById(pageId);

    if (!page) return;

    page.querySelectorAll("form").forEach(form => {
        form.reset();
    });

    page.querySelectorAll("p[id$='Msg']").forEach(message => {
        message.textContent = "";
        message.style.color = "";
    });
}

function showPage(pageId) {

    document.querySelectorAll(".page").forEach(page => {
        if (page.id !== pageId) {
            clearPageForms(page.id);
            page.classList.remove("active");
        }
    });

    const selected = document.getElementById(pageId);

    if (!selected) return;

    selected.classList.add("active");

    if (pageId === "studentDashboard") {
        loadStudentDashboard();
    }

    if (pageId === "collegeDashboard") {
        loadCollegeApplications();
    }

    if (pageId === "adminDashboard") {
        loadAdminDashboard();
    }

    window.scrollTo(0, 0);
}

// =====================================
// LOGOUT
// =====================================

function logout() {
    localStorage.removeItem("studentToken");
    localStorage.removeItem("collegeToken");
    localStorage.removeItem("adminToken");

    showPage("home");
    alert("Logged out successfully");
}

// =====================================
// STUDENT REGISTRATION
// =====================================

async function registerStudent(event) {
    event.preventDefault();

    const form = event.target;

    const body = {
        name: form.elements.name.value.trim(),
        college: form.elements.college.value.trim(),
        admissionNumber: form.elements.admissionNumber.value.trim(),
        phone: form.elements.phone.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value
    };

    try {
        const data = await apiRequest("/students", {
            method: "POST",
            body: JSON.stringify(body)
        });

        form.reset();

        showMessage(
            "registerMsg",
            data.message || "Registration successful!",
            true
        );

    } catch (error) {
        showMessage("registerMsg", error.message);
    }
}

// =====================================
// STUDENT LOGIN
// =====================================

async function loginStudent(event) {
    event.preventDefault();

    const form = event.target;

    try {
        const data = await apiRequest("/students/login", {
            method: "POST",
            body: JSON.stringify({
                email: form.elements.email.value.trim(),
                password: form.elements.password.value
            })
        });

        saveToken("student", data.token);

        form.reset();
        showPage("studentDashboard");

    } catch (error) {
        showMessage("studentLoginMsg", error.message);
    }
}

// =====================================
// STUDENT PROFILE
// =====================================

async function loadStudentDetails() {
    try {
        const data = await apiRequest("/me", {
            headers: authHeaders("student")
        });

        const student = data.student;
        const container = document.getElementById("studentDetails");

        if (!student) return;

        if (container) {
            container.innerHTML = `
                <p><b>Name:</b> ${escapeHTML(student.name)}</p>
                <p><b>Email:</b> ${escapeHTML(student.email)}</p>
                <p><b>College:</b> ${escapeHTML(student.college)}</p>
                <p><b>Admission Number:</b> ${escapeHTML(student.admissionNumber)}</p>
                <p><b>Phone:</b> ${escapeHTML(student.phone)}</p>
            `;
        }

    } catch (error) {
        containerMessage("studentDetails", error.message);
    }
}

// =====================================
// APPLY FOR CONCESSION
// =====================================

async function applyConcession(event) {
    event.preventDefault();

    const form = event.target;

    try {
        const data = await apiRequest("/applications", {
            method: "POST",
            headers: authHeaders("student"),
            body: JSON.stringify({
                from: form.elements.from.value.trim(),
                to: form.elements.to.value.trim()
            })
        });

        form.reset();

        showMessage(
            "applyMsg",
            data.message || "Application submitted successfully!",
            true
        );

        loadStudentApplications();

    } catch (error) {
        showMessage("applyMsg", error.message);
    }
}

// =====================================
// STUDENT APPLICATIONS
// =====================================

async function loadStudentApplications() {
    try {
        const applications = await apiRequest("/student/applications", {
            headers: authHeaders("student")
        });

        const container = document.getElementById("dashboardApplications");
        const statusContainer = document.getElementById("statusList");
        const passContainer = document.getElementById("dashboardPass");

        if (!Array.isArray(applications)) return;

        if (container) {
            if (!applications.length) {
                container.innerHTML = "<p>No applications found.</p>";
            } else {
                container.innerHTML = applications.map(app => `
                    <div class="card">
                        <h3>Bus Concession Application</h3>
                        <p><b>From:</b> ${escapeHTML(app.from)}</p>
                        <p><b>To:</b> ${escapeHTML(app.to)}</p>
                        <p><b>Status:</b> ${escapeHTML(app.status)}</p>
                        <p><b>College Remarks:</b> ${escapeHTML(app.collegeRemarks || "No remarks")}</p>
                        <p><b>Admin Remarks:</b> ${escapeHTML(app.adminRemarks || "No remarks")}</p>
                    </div>
                `).join("");
            }
        }

        if (statusContainer) {
            statusContainer.innerHTML = container
                ? container.innerHTML
                : "<p>No applications found.</p>";
        }

        if (passContainer) {
            const approved = applications.filter(
                app => app.status === "Approved"
            );

            if (approved.length) {
                passContainer.innerHTML = approved.map(app => `
                    <div class="card">
                        <h3>Digital Bus Pass</h3>
                        <p>Pass ID: ${escapeHTML(app.passId)}</p>
                        <button onclick="displayDigitalPass('${escapeHTML(app._id)}')">
                            View Pass
                        </button>
                    </div>
                `).join("");
            } else {
                passContainer.innerHTML =
                    "<p>Digital pass will be available after final admin approval.</p>";
            }
        }

    } catch (error) {
        containerMessage("dashboardApplications", error.message);
    }
}

// =====================================
// DIGITAL QR BUS PASS
// =====================================

async function displayDigitalPass(applicationId) {
    try {
        const applications = await apiRequest("/student/applications", {
            headers: authHeaders("student")
        });

        const application = applications.find(
            app => app._id === applicationId
        );

        if (
            !application ||
            application.status !== "Approved" ||
            !application.passId
        ) {
            alert("Pass is not available.");
            return;
        }

        const passContainer = document.getElementById("passDetails");

        if (!passContainer) return;

        passContainer.innerHTML = `
            <div class="digital-pass" id="printablePass">
                <h2>SMART STUDENT BUS PASS</h2>
                <p><b>Student:</b> ${escapeHTML(application.name)}</p>
                <p><b>College:</b> ${escapeHTML(application.college)}</p>
                <p><b>Route:</b> ${escapeHTML(application.from)} to ${escapeHTML(application.to)}</p>
                <p><b>Pass ID:</b> ${escapeHTML(application.passId)}</p>
                <p><b>Valid From:</b> ${application.validFrom ? new Date(application.validFrom).toLocaleDateString() : "-"}</p>
                <p><b>Valid Until:</b> ${application.validUntil ? new Date(application.validUntil).toLocaleDateString() : "-"}</p>
                <div id="passQRCode"></div>
                <button onclick="printPass()">Print Pass</button>
            </div>
        `;

        if (typeof QRCode !== "undefined") {
            new QRCode(document.getElementById("passQRCode"), {
               text: "https://opposition-northeast-acm-consideration.trycloudflare.com/api/passes/" +
    encodeURIComponent(application.passId),
                width: 150,
                height: 150
            });
        }

    } catch (error) {
        alert(error.message);
    }
}

function printPass() {
    const content = document.getElementById("printablePass");

    if (!content) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        alert("Please allow pop-ups to print the pass.");
        return;
    }

=======
// STUDENT REGISTRATION
async function registerStudent() {
    const student = {
        name: document.getElementById("regName").value.trim(),
        college: document.getElementById("regCollege").value.trim(),
        phone: document.getElementById("regPhone").value.trim(),
        email: document.getElementById("regEmail").value.trim()
    };

    const message = document.getElementById("registerMsg");

    if (!student.name || !student.college || !student.phone || !student.email) {
        message.innerText = "Please fill all fields.";
        return;
    }

    try {
        const response = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(student)
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        message.innerText = "Registration Successfully Completed!";
        document.getElementById("regName").value = "";
        document.getElementById("regCollege").value = "";
        document.getElementById("regPhone").value = "";
        document.getElementById("regEmail").value = "";
    } catch (error) {
        message.innerText = "Registration failed: " + error.message;
    }
}


// APPLY CONCESSION
async function applyConcession() {
    const application = {
        name: document.getElementById("sName").value.trim(),
        college: document.getElementById("sCollege").value.trim(),
        from: document.getElementById("sFrom").value.trim(),
        to: document.getElementById("sTo").value.trim()
    };

    if (!application.name || !application.college || !application.from || !application.to) {
        alert("Please fill all fields.");
        return;
    }

    try {
        const response = await fetch("/api/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(application)
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        document.getElementById("applyMsg").innerText =
    "Application Submitted Successfully!";

    // CLEAR FORM FIELDS
    document.getElementById("sName").value = "";
    document.getElementById("sCollege").value = "";
    document.getElementById("sFrom").value = "";
    document.getElementById("sTo").value = "";
    } catch (error) {
        alert("Application failed: " + error.message);
    }
}

// DIGITAL PASS DISPLAY
function displayDigitalPass(app) {
    if (app.status !== "Approved") {
        return "Your application is not approved yet.";
    }

    return `
        <div class="digital-pass">
            <h3>🚌 SMART STUDENT BUS PASS</h3>

            <p><strong>Student Name:</strong> ${app.name}</p>
            <p><strong>College:</strong> ${app.college || "Not available"}</p>
            <p><strong>Route:</strong> ${app.from} to ${app.to}</p>
            <p><strong>Pass ID:</strong> ${app.passId}</p>
            <p><strong>Valid From:</strong> ${new Date(app.validFrom).toLocaleDateString("en-IN")}</p>
            <p><strong>Valid Until:</strong> ${new Date(app.validUntil).toLocaleDateString("en-IN")}</p>

            <p><strong>Status:</strong> ${app.status}</p>

            <div id="qrcode-${app._id}"></div>
            <button style="margin-top: 20px;" onclick="printPass(this)">Print Pass</button>
        </div>
    `;
}

// PRINT DIGITAL PASS
function printPass(button) {
    const pass = button.closest(".digital-pass");

    const printWindow = window.open("", "_blank");

>>>>>>> 52ebb8c0daac9c8d02f93fdd6a854ee55ce01565
    printWindow.document.write(`
        <html>
        <head>
            <title>Student Bus Pass</title>
            <style>
                body {
                    font-family: Arial;
<<<<<<< HEAD
                    padding: 25px;
                }

                .digital-pass {
                    border: 2px solid black;
                    padding: 20px;
                    max-width: 450px;
                }

=======
                    padding: 20px;
                }
                .digital-pass {
    border: 3px solid black;
    padding: 25px;
    width: 400px;
    margin: auto;
    background: white;
    color: black;
    font-size: 18px;
    line-height: 1.6;
}

.digital-pass h3 {
    text-align: center;
    font-size: 23px;
    font-weight: bold;
}

.digital-pass p {
    font-size: 17px;
    font-weight: 500;
}
>>>>>>> 52ebb8c0daac9c8d02f93fdd6a854ee55ce01565
                button {
                    display: none;
                }
            </style>
        </head>
        <body>
<<<<<<< HEAD
            ${content.innerHTML}
=======
            ${pass.outerHTML}
>>>>>>> 52ebb8c0daac9c8d02f93fdd6a854ee55ce01565
        </body>
        </html>
    `);

    printWindow.document.close();
<<<<<<< HEAD
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// =====================================
// STUDENT COMPLAINT REGISTRATION
// =====================================

async function addComplaint(event) {
    event.preventDefault();

    const form = event.target;

    try {
        const data = await apiRequest("/complaints", {
            method: "POST",
            headers: authHeaders("student"),
            body: JSON.stringify({
                type: form.elements.type.value,
                bus: form.elements.bus.value.trim(),
                description: form.elements.description.value.trim()
            })
        });

        form.reset();

        showMessage(
            "complaintMsg",
            data.message || "Complaint submitted successfully!",
            true
        );

        loadStudentComplaints();

    } catch (error) {
        showMessage("complaintMsg", error.message);
    }
}

// =====================================
// STUDENT VIEW COMPLAINTS
// =====================================

async function loadStudentComplaints() {
    try {
        const complaints = await apiRequest("/student/complaints", {
            headers: authHeaders("student")
        });

        const container = document.getElementById("dashboardComplaints");

        if (!container || !Array.isArray(complaints)) return;

        if (!complaints.length) {
            container.innerHTML = "<p>No complaints found.</p>";
            return;
        }

        container.innerHTML = complaints.map(c => `
            <div class="card">
                <p><b>Type:</b> ${escapeHTML(c.type)}</p>
                <p><b>Bus:</b> ${escapeHTML(c.bus || "-")}</p>
                <p><b>Description:</b> ${escapeHTML(c.description)}</p>
                <p><b>Status:</b> ${escapeHTML(c.status)}</p>
                <p><b>Admin Reply:</b> ${escapeHTML(c.adminResponse || "Waiting for reply")}</p>
            </div>
        `).join("");

    } catch (error) {
        containerMessage("dashboardComplaints", error.message);
    }
}

// =====================================
// STUDENT DASHBOARD
// =====================================

async function loadStudentDashboard() {
    if (!getToken("student")) {
        showPage("studentLogin");
        return;
    }

    await Promise.all([
        loadStudentDetails(),
        loadStudentApplications(),
        loadStudentComplaints()
    ]);
}

// =====================================
// COLLEGE REGISTRATION
// =====================================

async function registerCollege(event) {
    event.preventDefault();

    const form = event.target;

    try {
        const data = await apiRequest("/colleges/register", {
            method: "POST",
            body: JSON.stringify({
                name: form.elements.name.value.trim(),
                email: form.elements.email.value.trim(),
                password: form.elements.password.value
            })
        });

        form.reset();

        showMessage(
            "collegeRegisterMsg",
            data.message || "College registration submitted. Waiting for admin approval.",
            true
        );

    } catch (error) {
        showMessage("collegeRegisterMsg", error.message);
    }
}

// =====================================
// COLLEGE LOGIN
// =====================================

async function loginCollege(event) {
    event.preventDefault();

    const form = event.target;

    try {
        const data = await apiRequest("/colleges/login", {
            method: "POST",
            body: JSON.stringify({
                email: form.elements.email.value.trim(),
                password: form.elements.password.value
            })
        });

        saveToken("college", data.token);

        form.reset();
        showPage("collegeDashboard");

    } catch (error) {
        showMessage("collegeLoginMsg", error.message);
    }
}

// =====================================
// COLLEGE VIEW APPLICATIONS
// =====================================

async function loadCollegeApplications() {
    if (!getToken("college")) {
        showPage("collegeLogin");
        return;
    }

    try {
        const applications = await apiRequest("/college/applications", {
            headers: authHeaders("college")
        });

        const container = document.getElementById("collegeApplicationList");

        if (!container || !Array.isArray(applications)) return;

        if (!applications.length) {
            container.innerHTML = "<p>No applications found.</p>";
            return;
        }

        container.innerHTML = applications.map(app => `
            <div class="card">
                <h3>${escapeHTML(app.name)}</h3>
                <p><b>Admission Number:</b> ${escapeHTML(app.admissionNumber || "-")}</p>
                <p><b>From:</b> ${escapeHTML(app.from)}</p>
                <p><b>To:</b> ${escapeHTML(app.to)}</p>
                <p><b>Status:</b> ${escapeHTML(app.status)}</p>

                ${
                    app.status === "Pending College Verification"
                    ? `
                        <textarea id="remarks_${escapeHTML(app._id)}" placeholder="Enter remarks"></textarea>
                        <button onclick="verifyApplication('${escapeHTML(app._id)}','Verified')">Verify</button>
                        <button onclick="verifyApplication('${escapeHTML(app._id)}','Rejected')">Reject</button>
                    `
                    : ""
                }
            </div>
        `).join("");

    } catch (error) {
        containerMessage("collegeApplicationList", error.message);
    }
}

// =====================================
// COLLEGE VERIFY / REJECT
// =====================================

async function verifyApplication(id, decision) {
    const remarksElement = document.getElementById("remarks_" + id);
    const remarks = remarksElement ? remarksElement.value.trim() : "";

    if (!confirm("Are you sure you want to " + decision + "?")) return;

    try {
        const data = await apiRequest(
            "/college/applications/" + encodeURIComponent(id) + "/verify",
            {
                method: "PATCH",
                headers: authHeaders("college"),
                body: JSON.stringify({
                    decision,
                    remarks
                })
            }
        );

        alert(data.message || "Application updated successfully.");
        loadCollegeApplications();

    } catch (error) {
        alert(error.message);
    }
}

// =====================================
// ADMIN LOGIN
// =====================================

async function loginAdmin(event) {
    event.preventDefault();

    const form = event.target;

    try {
        const data = await apiRequest("/admin/login", {
            method: "POST",
            body: JSON.stringify({
                email: form.elements.email.value.trim(),
                password: form.elements.password.value
            })
        });

        saveToken("admin", data.token);

        form.reset();
        showPage("adminDashboard");

    } catch (error) {
        showMessage("adminLoginMsg", error.message);
    }
}

// =====================================
// ADMIN DASHBOARD SUMMARY
// =====================================

async function loadAdminSummary() {
    try {
        const data = await apiRequest("/admin/dashboard", {
            headers: authHeaders("admin")
        });

        const container = document.getElementById("adminSummary");

        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <h3>Total Students</h3>
                <p>${data.totalStudents ?? 0}</p>
            </div>

            <div class="card">
                <h3>Total Colleges</h3>
                <p>${data.totalColleges ?? 0}</p>
            </div>

            <div class="card">
                <h3>Pending Colleges</h3>
                <p>${data.pendingColleges ?? 0}</p>
            </div>

            <div class="card">
                <h3>Total Applications</h3>
                <p>${data.totalApplications ?? 0}</p>
            </div>

            <div class="card">
                <h3>Pending Applications</h3>
                <p>${data.pendingApplications ?? 0}</p>
            </div>

            <div class="card">
                <h3>Approved Applications</h3>
                <p>${data.approvedApplications ?? 0}</p>
            </div>

            <div class="card">
                <h3>Total Complaints</h3>
                <p>${data.totalComplaints ?? 0}</p>
            </div>

            <div class="card">
                <h3>Pending Complaints</h3>
                <p>${data.pendingComplaints ?? 0}</p>
            </div>
        `;

    } catch (error) {
        containerMessage("adminSummary", error.message);
    }
}

// =====================================
// ADMIN VIEW STUDENTS
// =====================================

async function loadAdminStudents() {
    try {
        const students = await apiRequest("/students", {
            headers: authHeaders("admin")
        });

        const container = document.getElementById("studentList");

        if (!container || !Array.isArray(students)) return;

        if (!students.length) {
            container.innerHTML = "<p>No students registered.</p>";
            return;
        }

        container.innerHTML = students.map(student => `
            <div class="card">
                <p><b>Name:</b> ${escapeHTML(student.name)}</p>
                <p><b>Email:</b> ${escapeHTML(student.email)}</p>
                <p><b>College:</b> ${escapeHTML(student.college)}</p>
                <p><b>Admission Number:</b> ${escapeHTML(student.admissionNumber)}</p>
                <p><b>Phone:</b> ${escapeHTML(student.phone)}</p>
            </div>
        `).join("");

    } catch (error) {
        containerMessage("studentList", error.message);
    }
}

// =====================================
// ADMIN VIEW COLLEGES
// =====================================

async function loadAdminColleges() {
    try {
        const colleges = await apiRequest("/admin/colleges", {
            headers: authHeaders("admin")
        });

        const container = document.getElementById("collegeList");

        if (!container || !Array.isArray(colleges)) return;

        if (!colleges.length) {
            container.innerHTML = "<p>No colleges found.</p>";
            return;
        }

        container.innerHTML = colleges.map(college => `
            <div class="card">
                <h3>${escapeHTML(college.name)}</h3>
                <p><b>Email:</b> ${escapeHTML(college.email)}</p>
                <p><b>Status:</b> ${escapeHTML(college.status)}</p>

                ${
                    college.status === "Pending"
                    ? `
                        <button onclick="collegeDecision('${escapeHTML(college._id)}','Approved')">
                            Approve College
                        </button>

                        <button onclick="collegeDecision('${escapeHTML(college._id)}','Rejected')">
                            Reject College
                        </button>
                    `
                    : ""
                }
            </div>
        `).join("");

    } catch (error) {
        containerMessage("collegeList", error.message);
    }
}

// =====================================
// ADMIN APPROVE / REJECT COLLEGE
// =====================================

async function collegeDecision(id, decision) {
    if (!confirm("Are you sure you want to " + decision + " this college?")) {
        return;
    }

    try {
        const data = await apiRequest(
            "/admin/colleges/" + encodeURIComponent(id) + "/decision",
            {
                method: "PATCH",
                headers: authHeaders("admin"),
                body: JSON.stringify({ decision })
            }
        );

        alert(data.message || "College status updated.");

        loadAdminColleges();
        loadAdminSummary();

    } catch (error) {
        alert(error.message);
    }
}

// =====================================
// ADMIN VIEW APPLICATIONS
// =====================================

async function loadAdminApplications() {
    try {
        const applications = await apiRequest("/applications", {
            headers: authHeaders("admin")
        });

        const container = document.getElementById("appList");

        if (!container || !Array.isArray(applications)) return;

        if (!applications.length) {
            container.innerHTML = "<p>No applications found.</p>";
            return;
        }

        container.innerHTML = applications.map(app => `
            <div class="card">
                <h3>${escapeHTML(app.name)}</h3>
                <p><b>College:</b> ${escapeHTML(app.college)}</p>
                <p><b>Admission Number:</b> ${escapeHTML(app.admissionNumber || "-")}</p>
                <p><b>Route:</b> ${escapeHTML(app.from)} to ${escapeHTML(app.to)}</p>
                <p><b>Status:</b> ${escapeHTML(app.status)}</p>
                <p><b>College Remarks:</b> ${escapeHTML(app.collegeRemarks || "No remarks")}</p>

                ${
                    app.status === "College Verified"
                    ? `
                        <textarea id="adminRemarks_${escapeHTML(app._id)}" placeholder="Admin remarks"></textarea>

                        <button onclick="adminDecision('${escapeHTML(app._id)}','Approved')">
                            Final Approve
                        </button>

                        <button onclick="adminDecision('${escapeHTML(app._id)}','Rejected')">
                            Reject
                        </button>
                    `
                    : ""
                }
            </div>
        `).join("");

    } catch (error) {
        containerMessage("appList", error.message);
    }
}

// =====================================
// ADMIN FINAL APPLICATION DECISION
// =====================================

async function adminDecision(id, decision) {
    const remarksElement = document.getElementById("adminRemarks_" + id);
    const remarks = remarksElement ? remarksElement.value.trim() : "";

    if (!confirm("Confirm final decision: " + decision + "?")) return;

    try {
        const data = await apiRequest(
            "/admin/applications/" + encodeURIComponent(id) + "/decision",
            {
                method: "PATCH",
                headers: authHeaders("admin"),
                body: JSON.stringify({
                    decision,
                    remarks
                })
            }
        );

        alert(data.message || "Application decision updated.");

        loadAdminApplications();
        loadAdminSummary();

    } catch (error) {
        alert(error.message);
    }
}

// =====================================
// ADMIN VIEW COMPLAINTS
// =====================================

async function loadAdminComplaints() {
    try {
        const complaints = await apiRequest("/complaints", {
            headers: authHeaders("admin")
        });

        const container = document.getElementById("compList");

        if (!container || !Array.isArray(complaints)) return;

        if (!complaints.length) {
            container.innerHTML = "<p>No complaints found.</p>";
            return;
        }

        container.innerHTML = complaints.map(c => `
            <div class="card">
                <h3>Student Complaint</h3>
                <p><b>Student:</b> ${escapeHTML(c.studentId?.name || "Student")}</p>
                <p><b>Type:</b> ${escapeHTML(c.type)}</p>
                <p><b>Bus:</b> ${escapeHTML(c.bus || "-")}</p>
                <p><b>Description:</b> ${escapeHTML(c.description)}</p>
                <p><b>Status:</b> ${escapeHTML(c.status)}</p>

                <textarea id="reply_${escapeHTML(c._id)}" placeholder="Enter admin reply">${escapeHTML(c.adminResponse || "")}</textarea>

                <select id="complaintStatus_${escapeHTML(c._id)}">
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                </select>

                <button onclick="updateComplaint('${escapeHTML(c._id)}')">
                    Update Complaint
                </button>
            </div>
        `).join("");

        complaints.forEach(c => {
            const select = document.getElementById(
                "complaintStatus_" + c._id
            );

            if (select) {
                select.value = c.status;
            }
        });

    } catch (error) {
        containerMessage("compList", error.message);
    }
}

// =====================================
// ADMIN UPDATE COMPLAINT
// =====================================

async function updateComplaint(id) {
    const replyElement = document.getElementById("reply_" + id);
    const statusElement = document.getElementById("complaintStatus_" + id);

    if (!replyElement || !statusElement) return;

    try {
        const data = await apiRequest(
            "/complaints/" + encodeURIComponent(id) + "/status",
            {
                method: "PATCH",
                headers: authHeaders("admin"),
                body: JSON.stringify({
                    status: statusElement.value,
                    adminResponse: replyElement.value.trim()
                })
            }
        );

        alert(data.message || "Complaint updated successfully.");

        loadAdminComplaints();

    } catch (error) {
        alert(error.message);
    }
}

// =====================================
// ADMIN DASHBOARD
// =====================================

async function loadAdminDashboard() {
    if (!getToken("admin")) {
        showPage("adminLogin");
        return;
    }

    await Promise.all([
        loadAdminSummary(),
        loadAdminStudents(),
        loadAdminColleges(),
        loadAdminApplications(),
        loadAdminComplaints()
    ]);
}

// =====================================
// PAGE INITIALIZATION
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("form").forEach(form => {
        const clearMessage = () => {
            const message = form.querySelector("p[id$='Msg']");

            if (message) {
                message.textContent = "";
                message.style.color = "";
            }
        };

        form.addEventListener("input", clearMessage);
        form.addEventListener("change", clearMessage);
    });

    showPage("home");
});

window.addEventListener("pageshow", function () {
    document.querySelectorAll(
        "#studentLogin form, #collegeLogin form, #adminLogin form"
    ).forEach(form => {
        form.reset();
    });
});
=======
    printWindow.print();
}

// TRACK APPLICATION STATUS
async function trackStatus() {
    const name = document.getElementById("trackName").value.trim();
    const result = document.getElementById("trackResult");

    if (!name) {
        result.innerText = "Please enter your name.";
        return;
    }

    try {
        const response = await fetch("/api/applications");
        const applications = await response.json();

        if (!response.ok) throw new Error("Could not load applications.");

        const studentApplications = applications.filter(
            app => app.name.toLowerCase() === name.toLowerCase()
        );

        if (studentApplications.length === 0) {
            result.innerText = "No application found.";
            return;
        }

        result.innerHTML = studentApplications.map(app => `
    <div class="card">
        <p>
            From: ${app.from}<br>
            To: ${app.to}<br>
            Status: <strong>${app.status}</strong>
        </p>
    </div>
    `).join("");    
    studentApplications.forEach(app => {
    if (app.status === "Approved") {
        const qrElement = document.getElementById("qrcode-" + app._id);

        if (qrElement) {
            new QRCode(qrElement, {
                text: JSON.stringify({
                    passId: app.passId,
                    name: app.name,
                    college: app.college,
                    route: app.from + " to " + app.to,
                    validUntil: app.validUntil,
                    status: app.status
                }),
                width: 150,
                height: 150
            });
        }
    }
}); 
    } catch (error) {
        result.innerText = error.message;
    }
}


// ADD COMPLAINT
async function addComplaint() {
    const complaint = {
        id: "CMP" + Math.floor(1000 + Math.random() * 9000),
        name: document.getElementById("cName").value.trim(),
        type: document.getElementById("cType").value,
        bus: document.getElementById("cBus").value.trim(),
        description: document.getElementById("cDesc").value.trim()
    };

    if (!complaint.name || !complaint.type ||
        !complaint.bus || !complaint.description) {
        alert("Please fill all fields.");
        return;
    }

    try {
        const response = await fetch("/api/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(complaint)
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        document.getElementById("complaintMsg").innerText =
    "Complaint Submitted Successfully! Ticket ID: " + complaint.id;
    document.getElementById("cName").value = "";
    document.getElementById("cType").selectedIndex = 0;
    document.getElementById("cBus").value = "";
    document.getElementById("cDesc").value = "";
    } catch (error) {
        alert("Complaint failed: " + error.message);
    }
}


// LOAD ADMIN DATA
async function loadAdmin() {
    const appList = document.getElementById("appList");
    const compList = document.getElementById("compList");
    const studentList = document.getElementById("studentList");

    try {
        const [appResponse, compResponse, studentResponse] = await Promise.all([
            fetch("/api/applications"),
            fetch("/api/complaints"),
            fetch("/api/students")
        ]);

        const apps = await appResponse.json();
        const comps = await compResponse.json();
        const students = await studentResponse.json();

        if (!appResponse.ok || !compResponse.ok || !studentResponse.ok) {
            throw new Error("Could not load admin data.");
        }

        appList.innerHTML = apps.map((app) => `
            <div>
                <p>
                    ${app.name} - ${app.from} to ${app.to}
                    <br>Status: ${app.status}
                </p>
            ${app.status === "Pending" ? `
    <button onclick="updateApplication('${app._id}', 'Approved')">
        Approve
    </button>
    <button onclick="updateApplication('${app._id}', 'Rejected')">
        Reject
    </button>
` : ""}
            <hr>
        `).join("");

        compList.innerHTML = comps.map((comp) => `
            <div>
                <p>
                    ${comp.id} - ${comp.name}
                    <br>Type: ${comp.type}
                    <br>Bus: ${comp.bus}
                    <br>Description: ${comp.description}
                    <br>Status: ${comp.status}
                    <br>
                   ${!comp.adminResponse ? `
                   <label>Admin Response:</label>
                   <input type="text" id="response-${comp._id}"
                   placeholder="Enter your response">
                   <button onclick="sendComplaintResponse('${comp._id}')">
                       Send Response
             </button>
` : `
    <p>Admin Response: ${comp.adminResponse}</p>
`} 
                </p>
                ${comp.status !== "Resolved" ? `
    <button style="margin-top: 10px;"
 onclick="resolveComplaint('${comp._id}')">
    Resolve
</button>
` : ""}
            </div>
            <hr>
        `).join("");

        studentList.innerHTML = students.map(student => `
    <div class="card">
        <p><strong>Student Name:</strong> ${student.name}</p>
        <p><strong>College Name:</strong> ${student.college}</p>
        <p><strong>Phone Number:</strong> ${student.phone}</p>
        <p><strong>Email Address:</strong> ${student.email}</p>
    </div>
    <hr>
`).join("");

    } catch (error) {
        console.log(error);
    }
}


// UPDATE APPLICATION
async function updateApplication(id, status) {
    try {
        const response = await fetch(`/api/applications/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });

        if (!response.ok) throw new Error("Update failed.");

        alert("Application " + status + "!");
        loadAdmin();
    } catch (error) {
        alert(error.message);
    }
}


// RESOLVE COMPLAINT
async function resolveComplaint(id) {
    try {
        const response = await fetch(`/api/complaints/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Resolved" })
        });

        if (!response.ok) throw new Error("Update failed.");

        alert("Complaint Resolved!");
        loadAdmin();
    } catch (error) {
        alert(error.message);
    }
}
// STUDENT DASHBOARD
async function loadStudentDashboard() {
    const name = document.getElementById("dashboardName").value.trim();
    const pass = document.getElementById("dashboardPass");
    const complaints = document.getElementById("dashboardComplaints");

    pass.innerHTML = "";
    complaints.innerHTML = "";

    document.getElementById("dashboardName").addEventListener("input", () => {
    document.getElementById("dashboardPass").innerHTML = "";
    document.getElementById("dashboardComplaints").innerHTML = "";
});

    if (!name) {
        pass.innerText = "Please enter your name.";
        return;
    }

    try {
        const [studentRes, appRes, complaintRes] = await Promise.all([
            fetch("/api/students"),
            fetch("/api/applications"),
            fetch("/api/complaints")
        ]);

        const [students, applications, allComplaints] = await Promise.all([
            studentRes.json(),
            appRes.json(),
            complaintRes.json()
        ]);

        if (!studentRes.ok || !appRes.ok || !complaintRes.ok) {
            throw new Error("Unable to load dashboard details.");
        }

        const match = value =>
            value && value.toLowerCase() === name.toLowerCase();

        const student = students.find(s => match(s.name));
        const myApplications = applications.filter(a => match(a.name));
        const myComplaints = allComplaints.filter(c => match(c.name));

        if (!student && !myApplications.length && !myComplaints.length) {
            pass.innerText = "No student details found.";
            return;
        }

        if (student) {
            pass.innerHTML += `
                <h3>Student Details</h3>
                <p>Name: ${student.name}</p>
                <p>College: ${student.college}</p>
                <p>Phone: ${student.phone}</p>
                <p>Email: ${student.email}</p>
            `;
        }

        if (myApplications.length) {
            pass.innerHTML += "<h3>My Concession Applications</h3>";

            myApplications.forEach(app => {
                pass.innerHTML += `
                    <div>
                        <p>From: ${app.from}</p>
                        <p>To: ${app.to}</p>
                        <p>Status: ${app.status}</p>
                        ${displayDigitalPass(app)}
                    </div>
                `;
            });
            myApplications.forEach(app => {
    if (app.status === "Approved") {
        const qrElement = document.getElementById("qrcode-" + app._id);

        if (qrElement) {
            new QRCode(qrElement, {
                text: JSON.stringify({
                    passId: app.passId,
                    name: app.name,
                    college: app.college,
                    route: app.from + " to " + app.to,
                    validUntil: app.validUntil,
                    status: app.status
                }),
                width: 150,
                height: 150
            });
        }
    }
});
        } else {
            pass.innerHTML += "<p>No concession application found.</p>";
        }

        if (myComplaints.length) {
            complaints.innerHTML = "<h3>My Complaints</h3>";

            myComplaints.forEach(c => {
                complaints.innerHTML += `
                    <p>Ticket ID: ${c.id}</p>
                    <p>Complaint Type: ${c.type}</p>
                    <p>Bus Number: ${c.bus}</p>
                    <p>Description: ${c.description}</p>
                    <p>Status: ${c.status}</p>
                    <p>Admin Response: ${c.adminResponse || "No response yet"}</p>
                    <hr>
                `;
            });
        } else {
            complaints.innerHTML = "<p>No complaints found.</p>";
        }

    } catch (error) {
        pass.innerText = error.message;
    }
}
// SEND COMPLAINT RESPONSE
async function sendComplaintResponse(id) {
    const responseText = document.getElementById("response-" + id).value.trim();

    if (!responseText) {
        alert("Please enter an admin response.");
        return;
    }

    try {
        const response = await fetch(`/api/complaints/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                adminResponse: responseText
            })
        });

        if (!response.ok) {
            throw new Error("Failed to send response.");
        }

        alert("Admin Response Sent Successfully!");
        loadAdmin();

    } catch (error) {
        alert(error.message);
    }
}
// CLEAR REGISTRATION MESSAGE WHEN USER TYPES
["regName", "regCollege", "regPhone", "regEmail"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
        document.getElementById("registerMsg").innerText = "";
    });
});
// CLEAR APPLY MESSAGE WHEN USER TYPES
["sName", "sCollege", "sFrom", "sTo"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
        document.getElementById("applyMsg").innerText = "";
    });
});
// CLEAR TRACK RESULT WHEN USER TYPES
document.getElementById("trackName").addEventListener("input", () => {
    document.getElementById("trackResult").innerHTML = "";
});
// CLEAR COMPLAINT MESSAGE WHEN USER TYPES
["cName", "cType", "cBus", "cDesc"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
        document.getElementById("complaintMsg").innerText = "";
    });
});
