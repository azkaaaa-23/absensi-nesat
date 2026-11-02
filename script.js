const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbySy0jss4hZ_JxnYwlnUkdvEBxss1VS6bgMaihDpThDRVf23XaelI5tCZ58mGj_tVdfOg/exec";

// Password Terpisah (Terenkripsi Base64)
const HASH_GURU = "Z3VydW5lc2F0MjAyNg=="; // gurunesat2026
const HASH_ADMIN = "YWRtaW5uZXNhdDIwMjY="; // adminnesat2026

let html5QrCode = null;

document.addEventListener("DOMContentLoaded", function() {
    initScanner();
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    if (tabName === 'scanner') {
        document.getElementById('scanner-section').classList.add('active');
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else if (tabName === 'login-pilihan') {
        document.getElementById('login-pilihan-section').classList.add('active');
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}

function showLogin(role) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    if (role === 'guru') {
        document.getElementById('login-guru-section').classList.add('active');
    } else {
        document.getElementById('login-admin-section').classList.add('active');
    }
}

// --- INISIALISASI KAMERA YANG LEBIH RESPONSIF ---
function initScanner() {
    if (html5QrCode) {
        try {
            html5QrCode.stop().catch(() => {});
        } catch (e) {}
    }

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
            // Ketika QR berhasil terbaca oleh kamera
            document.getElementById('scan-result').style.color = "#7e22ce";
            document.getElementById('scan-result').innerText = "QR Terbaca: " + decodedText + ". Memproses...";
            kirimAbsensi(decodedText);
        },
        (errorMessage) => {
            // Error scanning tiap frame dibiarkan kosong agar tidak mengganggu
        }
    ).catch(err => {
        // Coba fallback ke kamera depan jika kamera belakang error
        html5QrCode.start(
            { facingMode: "user" }, 
            config, 
            (decodedText) => {
                document.getElementById('scan-result').style.color = "#7e22ce";
                document.getElementById('scan-result').innerText = "QR Terbaca: " + decodedText + ". Memproses...";
                kirimAbsensi(decodedText);
            },
            () => {}
        ).catch(e => {
            document.getElementById('scan-result').style.color = "red";
            document.getElementById('scan-result').innerText = "Kamera tidak dapat diakses. Periksa izin browser.";
        });
    });
}

// KIRIM DATA ABSENSI KE GOOGLE SHEETS
function kirimAbsensi(qrText) {
    fetch(WEB_APP_URL + "?action=getSiswa")
    .then(res => res.json())
    .then(dataSiswa => {
        let siswa = dataSiswa.find(s => s.qr == qrText || s.nis == qrText);
        if (siswa) {
            fetch(WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "Scan",
                    nis: siswa.nis,
                    nama: siswa.nama,
                    kelas: siswa.kelas
                })
            })
            .then(res => res.json())
            .then(response => {
                document.getElementById('scan-result').style.color = "green";
                document.getElementById('scan-result').innerText = response.message;
                setTimeout(() => {
                    document.getElementById('scan-result').innerText = "Arahkan QR Code ke kamera...";
                }, 4000);
            });
        } else {
            document.getElementById('scan-result').style.color = "red";
            document.getElementById('scan-result').innerText = "QR Code / NIS tidak ditemukan di database!";
            setTimeout(() => {
                document.getElementById('scan-result').innerText = "Arahkan QR Code ke kamera...";
            }, 3000);
        }
    }).catch(err => {
        console.error("Gagal koneksi:", err);
    });
}

// LOGIN GURU
function loginGuruAction() {
    let pass = document.getElementById('guru-pass').value;
    if (btoa(pass) === HASH_GURU) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById('dashboard-guru-section').classList.add('active');
        loadDataGuru();
        document.getElementById('guru-pass').value = "";
    } else {
        alert("Password Guru Salah!");
    }
}

// LOGIN ADMIN
function loginAdminAction() {
    let pass = document.getElementById('admin-pass').value;
    if (btoa(pass) === HASH_ADMIN) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.getElementById('dashboard-admin-section').classList.add('active');
        loadDataAdminChart();
        document.getElementById('admin-pass').value = "";
    } else {
        alert("Password Admin Salah!");
    }
}

function logoutSystem() {
    switchTab('scanner');
}

// LOAD DATA DI TAB GURU
function loadDataGuru() {
    Promise.all([
        fetch(WEB_APP_URL + "?action=getSiswa").then(res => res.json()),
        fetch(WEB_APP_URL + "?action=getPresensiHariIni").then(res => res.json())
    ])
    .then(([listSiswa, presensiHariIni]) => {
        let tbody = document.getElementById('tbody-guru');
        tbody.innerHTML = "";
        
        if(listSiswa.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada data siswa di spreadsheet.</td></tr>`;
            return;
        }

        listSiswa.forEach(siswa => {
            let presensi = presensiHariIni[siswa.nis] || { jamMasuk: "-", jamPulang: "-", status: "Belum Absen" };
            
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${siswa.nis}</td>
                <td>${siswa.nama}</td>
                <td>${siswa.kelas}</td>
                <td>${presensi.jamMasuk}</td>
                <td>${presensi.jamPulang}</td>
                <td><b>${presensi.status}</b></td>
                <td>
                    <select onchange="ubahStatus('${siswa.nis}', this.value)">
                        <option value="">Pilih...</option>
                        <option value="Hadir" ${presensi.status === 'Hadir' ? 'selected' : ''}>Hadir</option>
                        <option value="Sakit" ${presensi.status === 'Sakit' ? 'selected' : ''}>Sakit</option>
                        <option value="Izin" ${presensi.status === 'Izin' ? 'selected' : ''}>Izin</option>
                        <option value="Alfa" ${presensi.status === 'Alfa' ? 'selected' : ''}>Alfa</option>
                        <option value="Terlambat" ${presensi.status === 'Terlambat' ? 'selected' : ''}>Terlambat</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    })
    .catch(err => {
        console.error("Gagal memuat data:", err);
    });
}

function ubahStatus(nis, statusBaru) {
    if (!statusBaru) return;
    fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "UpdateStatus",
            nis: nis,
            status: statusBaru
        })
    })
    .then(res => res.json())
    .then(res => {
        alert("Status berhasil diubah!");
        loadDataGuru();
    });
}

// LOAD DIAGRAM REKAP DI ADMIN
let myChart = null;
function loadDataAdminChart() {
    fetch(WEB_APP_URL + "?action=getPresensiHariIni")
    .then(res => res.json())
    .then(dataPresensi => {
        let countHadir = 0, countSakit = 0, countIzin = 0, countAlfa = 0, countTerlambat = 0;
        
        Object.values(dataPresensi).forEach(row => {
            if (row.status === "Hadir") countHadir++;
            else if (row.status === "Sakit") countSakit++;
            else if (row.status === "Izin") countIzin++;
            else if (row.status === "Alfa") countAlfa++;
            else if (row.status === "Terlambat") countTerlambat++;
        });

        let ctx = document.getElementById('rekapChart').getContext('2d');
        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Hadir', 'Sakit', 'Izin', 'Alfa', 'Terlambat'],
                datasets: [{
                    label: 'Jumlah Siswa',
                    data: [countHadir, countSakit, countIzin, countAlfa, countTerlambat],
                    backgroundColor: ['#7e22ce', '#a855f7', '#c084fc', '#e9d5ff', '#9333ea']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Grafik Rekapitulasi Kehadiran Siswa Hari Ini' }
                }
            }
        });
    });
}