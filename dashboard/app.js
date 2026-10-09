// DOM Elements
const eventsBody = document.getElementById('events-body');
const totalEventsEl = document.getElementById('total-events');
const criticalAlertsEl = document.getElementById('critical-alerts');
const searchInput = document.getElementById('search-input');
const toggleBtn = document.getElementById('toggle-sim-btn');
const toastContainer = document.getElementById('toast-container');

// State
let totalEvents = 1204;
let criticalAlerts = 12;
let isStreaming = true;
let streamInterval;
let allEvents = []; // Master list for filtering

// ---------------- Chart.js Setup ----------------
const ctx = document.getElementById('liveChart').getContext('2d');
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Outfit', sans-serif";

const liveChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(20).fill(''),
        datasets: [{
            label: 'Syscalls / sec',
            data: Array(20).fill(0),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, suggestedMax: 15 },
            x: { grid: { display: false } }
        },
        plugins: { legend: { display: false }, tooltip: { enabled: true } }
    }
});

// ---------------- Mock Data & Logic ----------------
const maliciousActivities = [
    { pid: 4321, process: 'com.evil.app', syscall: 'openat', target: '/data/data/com.android.providers.telephony/databases/mmssms.db', risk: 'critical', desc: 'SMS Theft Attempt' },
    { pid: 4321, process: 'com.evil.app', syscall: 'openat', target: '/data/data/com.android.providers.contacts/databases/contacts2.db', risk: 'critical', desc: 'Contacts Theft Attempt' },
    { pid: 4321, process: 'com.evil.app', syscall: 'execve', target: '/system/xbin/su', risk: 'critical', desc: 'Root Execution Attempt' },
    { pid: 4321, process: 'com.evil.app', syscall: 'openat', target: '/proc/self/maps', risk: 'warning', desc: 'Anti-Debugging Check' },
    { pid: 5122, process: 'com.android.chrome', syscall: 'openat', target: '/data/user/0/com.android.chrome/cache/sys_cache', risk: 'info', desc: 'Normal Cache Access' },
    { pid: 4321, process: 'com.evil.app', syscall: 'connect', target: '185.199.108.153:443', risk: 'critical', desc: 'Known C2 Connection' },
    { pid: 1024, process: 'system_server', syscall: 'bpf', target: 'BPF_PROG_LOAD', risk: 'warning', desc: 'Suspicious BPF Loading' },
    { pid: 6621, process: 'com.whatsapp', syscall: 'openat', target: '/data/data/com.whatsapp/databases/msgstore.db', risk: 'info', desc: 'App Database Access' }
];

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

// ---------------- Toast Notifications ----------------
function showToast(event) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon">🚨</div>
        <div class="toast-content">
            <h4>${event.desc}</h4>
            <p>${event.process} -> ${event.target.length > 30 ? event.target.substring(0, 30) + '...' : event.target}</p>
        </div>
    `;
    
    // Click to dismiss
    toast.onclick = () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    };
    
    toastContainer.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        if(toast.parentElement) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4500);
}

// ---------------- Table Rendering ----------------
function renderTable() {
    eventsBody.innerHTML = '';
    const filterText = searchInput.value.toLowerCase();
    
    // Filter the master list
    const filtered = allEvents.filter(e => 
        e.process.toLowerCase().includes(filterText) || 
        e.target.toLowerCase().includes(filterText) ||
        e.syscall.toLowerCase().includes(filterText)
    );

    // Re-render
    filtered.forEach(data => {
        const tr = document.createElement('tr');
        if (data.risk === 'critical') tr.classList.add('row-critical');
        
        tr.innerHTML = `
            <td>${data.time}</td>
            <td>${data.pid}</td>
            <td style="color: ${data.risk === 'critical' ? 'var(--accent-red)' : 'inherit'}">${data.process}</td>
            <td>${data.syscall}</td>
            <td>${data.target}</td>
            <td><span class="badge ${data.risk}">${data.risk}</span></td>
        `;
        eventsBody.appendChild(tr);
    });
}

function processNewEvent(data) {
    const eventWithTime = { ...data, time: getCurrentTime() };
    allEvents.unshift(eventWithTime); 
    
    // Keep max 50 items in history memory
    if (allEvents.length > 50) allEvents.pop(); 
    
    renderTable();

    // Stats
    totalEvents++;
    totalEventsEl.innerText = totalEvents.toLocaleString();
    
    if (data.risk === 'critical') {
        criticalAlerts++;
        criticalAlertsEl.innerText = criticalAlerts.toLocaleString();
        
        // Visual flash on the card
        const card = criticalAlertsEl.parentElement.parentElement;
        card.style.transform = 'scale(1.05) translateY(-5px)';
        card.style.boxShadow = '0 10px 30px rgba(239, 68, 68, 0.4)';
        setTimeout(() => {
            card.style.transform = '';
            card.style.boxShadow = '';
        }, 300);

        showToast(eventWithTime);
    }
}

// Initial Population
for(let i=0; i<8; i++) {
    processNewEvent(maliciousActivities[Math.floor(Math.random() * maliciousActivities.length)]);
}

// ---------------- Streaming Engine ----------------
let currentSyscallCount = 0;

function startStream() {
    streamInterval = setInterval(() => {
        // Generate between 1 and 4 events per tick
        const eventsThisTick = Math.floor(Math.random() * 4) + 1;
        currentSyscallCount += eventsThisTick;
        
        for(let i=0; i<eventsThisTick; i++) {
            // Bias towards info/warning, 15% chance for critical
            const rand = Math.random();
            let pool = maliciousActivities;
            if(rand > 0.15) {
                pool = maliciousActivities.filter(a => a.risk !== 'critical');
            }
            const event = pool[Math.floor(Math.random() * pool.length)];
            processNewEvent(event);
        }
    }, 1200);
}

// Chart Updater (Runs every second independently)
setInterval(() => {
    if(!isStreaming) return;
    const data = liveChart.data.datasets[0].data;
    // Add baseline noise to chart for realism
    data.push(currentSyscallCount * 2 + Math.floor(Math.random() * 5)); 
    data.shift();
    liveChart.update();
    currentSyscallCount = 0; // Reset counter for next second
}, 1000);

// ---------------- Event Listeners ----------------
searchInput.addEventListener('input', renderTable);

toggleBtn.addEventListener('click', () => {
    isStreaming = !isStreaming;
    if(isStreaming) {
        startStream();
        toggleBtn.innerText = "Pause Stream";
        toggleBtn.style.background = "rgba(59, 130, 246, 0.1)";
        document.querySelector('.pulse').style.animation = 'pulse 2s infinite';
        document.getElementById('status-text').innerText = 'Kernel Hook Active';
    } else {
        clearInterval(streamInterval);
        toggleBtn.innerText = "Resume Stream";
        toggleBtn.style.background = "rgba(239, 68, 68, 0.2)";
        toggleBtn.style.color = "var(--accent-red)";
        document.querySelector('.pulse').style.animation = 'none';
        document.getElementById('status-text').innerText = 'Monitoring Paused';
    }
});

// Start the engine
startStream();
