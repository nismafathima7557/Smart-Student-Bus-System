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

    printWindow.document.write(`
        <html>
        <head>
            <title>Student Bus Pass</title>
            <style>
                body {
                    font-family: Arial;
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
                button {
                    display: none;
                }
            </style>
        </head>
        <body>
            ${pass.outerHTML}
        </body>
        </html>
    `);

    printWindow.document.close();
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
