<template>
  <div class="card">
    <h2>📊 Returns Calculator</h2>

    <!-- NEW: Reset button is part of the caching feature -->
    <div class="actions-header">
       <button class="btn btn-secondary" @click="resetForm">Reset Data</button>
    </div>

    <!-- Terminals Grid -->
    <div class="terminals-grid" v-motion-fade-visible-once>
      <div v-for="(terminal, index) in terminals" :key="index" class="terminal-card">
        <div class="terminal-selector-group">
          <label :for="'terminal-select-' + index">Terminal</label>
          <select :id="'terminal-select-' + index" v-model="terminal.selectedTerminal">
            <option v-for="option in terminalOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
        
        <div class="input-grid">
          <div class="input-group"><label>BCA 1</label><input type="number" v-model.number="terminal.bca1" min="0" placeholder="0"></div>
          <div class="input-group"><label>BCA 2</label><input type="number" v-model.number="terminal.bca2" min="0" placeholder="0"></div>
          <div class="input-group"><label>BCA 3</label><input type="number" v-model.number="terminal.bca3" min="0" placeholder="0"></div>
          <div class="input-group"><label>RGC Bags</label><input type="number" v-model.number="terminal.rgcBags" min="0" placeholder="0"></div>
          <div class="input-group"><label>People</label><input type="number" v-model.number="terminal.people" min="0" placeholder="0"></div>
          <div class="input-group">
            <label>RGC Flights</label>
            <div class="stepper">
              <button @click="terminal.rgcFlights = Math.max(0, terminal.rgcFlights - 1)">-</button>
              <input type="number" v-model.number="terminal.rgcFlights" min="0" readonly>
              <button @click="terminal.rgcFlights++">+</button>
            </div>
          </div>
        </div>

        <div class="input-group full-width">
          <label>Muslim Countries</label>
          <textarea v-model="terminal.muslimCountries" rows="1"></textarea>
        </div>
      </div>
    </div>

    <!-- Summary & Actions -->
    <div class="summary-card">
      <h3>Overall Summary</h3>
      <div class="summary-grid">
        <p><strong>Total Flights:</strong> <span class="summary-value">{{ globalTotals.totalFlights }}</span></p>
        <p><strong>Total Bags:</strong> <span class="summary-value">{{ globalTotals.allTotalBags }}</span></p>
        <p><strong>Total People:</strong> <span class="summary-value">{{ globalTotals.allPeople }}</span></p>
      </div>
      
      <div class="per-terminal-summary">
        <h4>Terminal Breakdown</h4>
        <ul>
          <li v-for="(terminal, index) in terminals" :key="index">
            <span class="terminal-name-tag">{{ terminal.selectedTerminal }}</span>
            <span class="terminal-stat"><strong>Flights:</strong> {{ terminalTotals[index].totalFlights }}</span>
            <span class="terminal-stat"><strong>People:</strong> {{ terminal.people || 0 }}</span>
            <span class="terminal-stat"><strong>Total Bags:</strong> {{ terminalTotals[index].totalBags }}</span>
          </li>
        </ul>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" @click="copySummary">📋 Copy Summary</button>
        <button class="btn btn-primary" @click="uploadReturns" :disabled="isUploading">
          {{ isUploading ? 'Uploading...' : '☁️ Upload Returns' }}
        </button>
      </div>
      <p v-if="uploadStatus" class="upload-status" :class="statusType">{{ uploadStatus }}</p>
    </div>
  </div>
</template>

<script setup>
// NEW: Make sure watch and onMounted are imported
import { ref, computed, watch, onMounted } from 'vue';
import { storage } from '../services/firebase';
import { ref as storageRef, uploadString } from 'firebase/storage';

// NEW: Define the key for localStorage
const localStorageKey = 'returnsCalculatorData';

// --- State and Initial Setup ---
const terminalOptions = ['T1', 'T2', 'T3', 'T4'];

const getShiftDefaults = () => {
  const hour = new Date().getHours();
  return (hour >= 10 && hour < 22) ? ['T4', 'T1', 'T3'] : ['T4', 'T2', 'T3'];
};

const createDefaultTerminals = () => {
  const defaults = getShiftDefaults();
  return [
    { selectedTerminal: defaults[0], bca1: null, bca2: null, bca3: null, rgcBags: null, rgcFlights: 0, people: null, muslimCountries: '' },
    { selectedTerminal: defaults[1], bca1: null, bca2: null, bca3: null, rgcBags: null, rgcFlights: 0, people: null, muslimCountries: '' },
    { selectedTerminal: defaults[2], bca1: null, bca2: null, bca3: null, rgcBags: null, rgcFlights: 0, people: null, muslimCountries: '' },
  ];
};

const terminals = ref(createDefaultTerminals());
const isUploading = ref(false);
const uploadStatus = ref('');
const statusType = ref('');

// --- NEW: Caching Logic ---
onMounted(() => {
  const savedData = localStorage.getItem(localStorageKey);
  if (savedData) {
    try {
      const parsedData = JSON.parse(savedData);
      if (Array.isArray(parsedData) && parsedData.length === 3 && parsedData[0].hasOwnProperty('selectedTerminal')) {
        terminals.value = parsedData;
      }
    } catch (e) {
      console.error("Error parsing saved data from localStorage.", e);
      localStorage.removeItem(localStorageKey);
    }
  }
});

watch(terminals, (newTerminalsData) => {
  localStorage.setItem(localStorageKey, JSON.stringify(newTerminalsData));
}, { deep: true });

// --- Computed Properties ---
const terminalTotals = computed(() => {
  return terminals.value.map(t => { const totalBca = (t.bca1 || 0) + (t.bca2 || 0) + (t.bca3 || 0); const bcaFlights = (t.bca1 > 0 ? 1 : 0) + (t.bca2 > 0 ? 1 : 0) + (t.bca3 > 0 ? 1 : 0); const totalFlights = bcaFlights + (t.rgcFlights || 0); const totalBags = totalBca + (t.rgcBags || 0); return { totalBca, totalBags, totalFlights }; });
});
const globalTotals = computed(() => {
  return terminalTotals.value.reduce((acc, current, index) => { acc.totalFlights += current.totalFlights; acc.allTotalBags += current.totalBags; acc.allPeople += terminals.value[index].people || 0; return acc; }, { totalFlights: 0, allTotalBags: 0, allPeople: 0 });
});

// --- Methods ---
const generateCsvString = () => {
  let csv = ''; const headers = 'Total flights,bca bags,bca passengers,rgc bags,people,muslim countries\n';
  terminals.value.forEach((t, i) => {
    if (terminalTotals.value[i].totalFlights > 0 || terminalTotals.value[i].totalBags > 0 || (t.people || 0) > 0) {
      const totals = terminalTotals.value[i];
      const countries = `"${(t.muslimCountries || '').replace(/,/g, ';').replace(/\n/g, ', ')}"`;
      csv += `\nTerminal: ${t.selectedTerminal}\n`;
      csv += headers;
      const dataRow = [totals.totalFlights, totals.totalBca, 0, t.rgcBags || 0, t.people || 0, countries].join(',');
      csv += dataRow + '\n';
    }
  });
  return csv.trim();
};

const sendBrowserNotification = () => {
  // 1. Check if the browser supports notifications
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notification.");
    return;
  }

  // 2. Check if permission has already been granted
  if (Notification.permission === "granted") {
    createNotification();
  }
  
  // 3. If permission hasn't been granted, ask for it
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      // If the user accepts, create a notification
      if (permission === "granted") {
        createNotification();
      }
    });
  }
  // If permission is denied, we can't do anything.
};

const createNotification = () => {
  // 4. Format the message body from the terminal breakdown
  let notificationBody = '';
  terminals.value.forEach((terminal, index) => {
    const totals = terminalTotals.value[index];
    if (totals.totalFlights > 0 || totals.totalBags > 0 || (terminal.people || 0) > 0) {
      notificationBody += 
        `${terminal.selectedTerminal}: ${totals.totalFlights} flights, ${totals.totalBags} bags, ${terminal.people || 0} people\n`;
    }
  });

  if (notificationBody === '') {
    notificationBody = 'No data entered to summarize.';
  }

  const title = "Terminal Summary Copied!";
  
  const options = {
    body: notificationBody.trim(),
    icon: '/plane.svg', // Assumes plane.svg is in your /public folder
    badge: '/plane.svg' // For mobile notifications
  };

  // 5. Create and dispatch the notification
  new Notification(title, options);
};

const uploadReturns = async () => {
  isUploading.value = true;
  setUploadStatus('🔄 Uploading...', 'info');
  const csvContent = generateCsvString();
  const date = new Date().toISOString().split('T')[0];
  const filename = `returns/report-${date}.csv`;
  try {
    await uploadString(storageRef(storage, filename), csvContent, 'raw', { contentType: 'text/csv' });
    setUploadStatus(`✅ Successfully uploaded!`, 'success');

  } catch (error) {
    console.error("Upload failed:", error);
    setUploadStatus(`❌ Upload failed.`, 'error');
  } finally {
    isUploading.value = false;
  }
};

const resetForm = () => {
  if (confirm('Are you sure you want to clear all entered data?')) {
    localStorage.removeItem(localStorageKey);
    terminals.value = createDefaultTerminals();
    setUploadStatus('Form has been reset.', 'info');
  }
};

const copySummary = () => {
  // The clipboard logic remains the same
  const { totalFlights, allTotalBags, allPeople } = globalTotals.value;
  const summaryText = `${totalFlights} flights, ${allTotalBags} baggage, ${allPeople} people`;
  
  navigator.clipboard.writeText(summaryText)
    .then(() => {
      setUploadStatus('✅ Summary copied!', 'success');
      // NEW: Send a browser notification on successful copy
      sendBrowserNotification();
    })
    .catch(() => {
      setUploadStatus('❌ Copy failed.', 'error');
    });
};
const setUploadStatus = (message, type, duration = 4000) => { uploadStatus.value = message; statusType.value = type; setTimeout(() => { uploadStatus.value = ''; statusType.value = ''; }, duration); };
</script>

<style scoped>
/* NEW: Actions header style for the reset button */
.actions-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}
.actions-header .btn-secondary {
  background-color: #4a4a52;
}

/* (All other styles are unchanged and valid) */
.terminals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem; }
.terminal-card { background-color: var(--background-secondary); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; }
.input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.input-group { display: flex; flex-direction: column; }
.input-group.full-width { grid-column: 1 / -1; margin-top: 1.25rem; }
.input-group label { margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-secondary); }
.input-group input[type="number"], .input-group textarea, select { background-color: var(--background-primary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: inherit; font-size: 1rem; padding: 0.75rem 1rem; width: 100%; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
.input-group input[type="number"]:focus, .input-group textarea:focus, select:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.2); }
input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }
.terminal-selector-group { margin-bottom: 1.5rem; }
select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1em; padding-right: 2.5rem; }
.stepper { display: flex; height: calc(1rem * 0.75 * 2 + 1rem + 2px); }
.stepper input { flex-grow: 1; width: auto; text-align: center; border-radius: 0; border-left: none; border-right: none; padding: 0 0.5rem; }
.stepper button { width: 42px; background-color: #4a4a52; border: 1px solid var(--border-color); color: var(--text-primary); font-size: 1.2rem; font-weight: 500; cursor: pointer; flex-shrink: 0; display: grid; place-content: center; transition: background-color 0.2s ease; }
.stepper button:hover { background-color: #5a5a64; }
.stepper button:first-child { border-radius: 8px 0 0 8px; }
.stepper button:last-child { border-radius: 0 8px 8px 0; }
.summary-card { margin-top: 2rem; padding: 2rem; background-color: var(--background-secondary); border-radius: 12px; }
.summary-grid { display: flex; gap: 2rem; flex-wrap: wrap; }
.summary-value { font-size: 1.5rem; font-weight: 600; color: var(--accent-primary); }
.per-terminal-summary { margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; }
.per-terminal-summary h4 { margin-top: 0; margin-bottom: 1rem; color: var(--text-secondary); }
.per-terminal-summary ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.per-terminal-summary li { display: flex; align-items: center; gap: 1.5rem; background-color: #313138; padding: 0.75rem 1rem; border-radius: 8px; flex-wrap: wrap; }
.terminal-name-tag { background-color: var(--accent-primary); color: white; padding: 0.25rem 0.75rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem; }
.terminal-stat { font-size: 0.95rem; }
.actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-top: 2rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; }
.upload-status { margin-top: 1rem; margin-bottom: 0; font-weight: 500; padding: 0.5rem 1rem; border-radius: 6px; }
.upload-status.success { background-color: rgba(74, 222, 128, 0.2); color: #4ade80; }
.upload-status.error { background-color: rgba(255, 107, 107, 0.2); color: var(--error-color); }
.upload-status.info { background-color: rgba(0, 120, 212, 0.2); color: #3b82f6; }
</style>