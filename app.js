import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const el = {
  loginBtn: $("loginBtn"), logoutBtn: $("logoutBtn"), userName: $("userName"),
  temp: $("wxTemp"), label: $("wxLabel"), meta: $("wxMeta"), hint: $("wxHint"), refresh: $("refreshBtn"),
  notice: $("loginNotice"), form: $("memoForm"), input: $("memoInput"), status: $("status"),
  listSection: $("listSection"), list: $("memoList"), empty: $("emptyMsg")
};

// index.html과 id가 맞지 않으면 어떤 요소가 없는지 화면에 알려줌
const missing = Object.entries(el).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  const msg = "index.html에서 찾지 못한 요소: " + missing.join(", ") + " — index.html이 app.js와 같은 버전인지 확인하세요.";
  document.body.insertAdjacentHTML("afterbegin", '<p style="padding:12px;background:#fde;color:#900">' + msg + "</p>");
  throw new Error(msg);
}

/* ---------- 날씨 (Open-Meteo, 키 불필요) ---------- */
const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780" +
  "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
  "&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1";

const CODE_LABEL = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
  45: "안개", 48: "서리 안개",
  51: "가벼운 이슬비", 53: "이슬비", 55: "강한 이슬비",
  56: "얼어붙는 이슬비", 57: "강한 얼어붙는 이슬비",
  61: "약한 비", 63: "비", 65: "강한 비",
  66: "얼어붙는 비", 67: "강한 얼어붙는 비",
  71: "약한 눈", 73: "눈", 75: "강한 눈", 77: "싸락눈",
  80: "약한 소나기", 81: "소나기", 82: "강한 소나기",
  85: "약한 눈 소나기", 86: "강한 눈 소나기",
  95: "뇌우", 96: "우박 동반 뇌우", 99: "강한 우박 동반 뇌우"
};

let currentWeather = null; // 메모 저장 시 함께 기록

function outfitHint(feels) {
  if (feels >= 28) return "참고: 민소매·반팔, 얇고 통풍 잘 되는 옷이 어울려요.";
  if (feels >= 23) return "참고: 반팔에 얇은 셔츠 정도면 충분해요.";
  if (feels >= 17) return "참고: 얇은 가디건이나 맨투맨이 알맞아요.";
  if (feels >= 12) return "참고: 자켓이나 트렌치코트를 챙기세요.";
  if (feels >= 6) return "참고: 코트와 니트가 필요해요.";
  return "참고: 패딩, 목도리 등 방한용품을 챙기세요.";
}

async function loadWeather() {
  el.refresh.disabled = true;
  el.label.textContent = "날씨를 불러오는 중…";
  try {
    const res = await fetch(WEATHER_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const c = data.current;
    const label = CODE_LABEL[c.weather_code] ?? "알 수 없음";
    const max = Math.round(data.daily.temperature_2m_max[0]);
    const min = Math.round(data.daily.temperature_2m_min[0]);
    currentWeather = {
      temp: Math.round(c.temperature_2m),
      feels: Math.round(c.apparent_temperature),
      label
    };
    el.temp.textContent = `${currentWeather.temp}°`;
    el.label.textContent = `서울 · ${label}`;
    el.meta.textContent =
      `체감 ${currentWeather.feels}° · 최저 ${min}° / 최고 ${max}° · 습도 ${c.relative_humidity_2m}% · 바람 ${c.wind_speed_10m}km/h`;
    el.hint.textContent = outfitHint(c.apparent_temperature);
  } catch (e) {
    console.error(e);
    currentWeather = null;
    el.temp.textContent = "--°";
    el.label.textContent = "날씨를 불러오지 못했어요";
    el.meta.textContent = "네트워크를 확인하고 새로고침 버튼을 눌러주세요.";
    el.hint.textContent = "";
  } finally {
    el.refresh.disabled = false;
  }
}

/* ---------- Firebase ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;

function setStatus(msg, isError = false) {
  el.status.textContent = msg;
  el.status.classList.toggle("error", isError);
}

function memosRef(uid) {
  return collection(db, "users", uid, "memos");
}

async function login() {
  setStatus("");
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    console.error(e);
    if (e.code === "auth/unauthorized-domain") {
      setStatus("승인되지 않은 도메인이에요. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 현재 주소를 추가하세요.", true);
    } else if (e.code === "auth/popup-closed-by-user") {
      setStatus("로그인 창이 닫혔어요. 다시 시도해주세요.", true);
    } else if (e.code === "auth/popup-blocked") {
      setStatus("팝업이 차단됐어요. 브라우저에서 팝업을 허용해주세요.", true);
    } else {
      setStatus("로그인에 실패했어요: " + e.code, true);
    }
  }
}

async function loadMemos() {
  if (!currentUser) return;
  try {
    const snap = await getDocs(query(memosRef(currentUser.uid), orderBy("createdAt", "desc")));
    renderMemos(snap.docs);
  } catch (e) {
    console.error(e);
    setStatus("기록을 불러오지 못했어요. Firestore 규칙과 데이터베이스 생성 여부를 확인하세요.", true);
  }
}

function renderMemos(docs) {
  el.list.replaceChildren();
  el.empty.hidden = docs.length > 0;
  for (const d of docs) {
    const m = d.data();
    const li = document.createElement("li");

    const box = document.createElement("div");
    const text = document.createElement("p");
    text.className = "memo-text";
    text.textContent = m.text;
    const info = document.createElement("p");
    info.className = "memo-info";
    info.textContent = `${m.date} · ${m.weatherLabel ?? "-"} ${m.temp ?? "-"}° (체감 ${m.feels ?? "-"}°)`;
    box.append(text, info);

    const del = document.createElement("button");
    del.className = "btn del";
    del.type = "button";
    del.textContent = "삭제";
    del.addEventListener("click", async () => {
      if (!confirm("이 메모를 삭제할까요?")) return;
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "memos", d.id));
        await loadMemos();
      } catch (e) {
        console.error(e);
        setStatus("삭제에 실패했어요.", true);
      }
    });

    li.append(box, del);
    el.list.append(li);
  }
}

async function saveMemo(e) {
  e.preventDefault();
  const text = el.input.value.trim();
  if (!text || !currentUser) return;
  const btn = el.form.querySelector("button");
  btn.disabled = true;
  try {
    await addDoc(memosRef(currentUser.uid), {
      text,
      date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }),
      temp: currentWeather?.temp ?? null,
      feels: currentWeather?.feels ?? null,
      weatherLabel: currentWeather?.label ?? null,
      createdAt: serverTimestamp()
    });
    el.input.value = "";
    setStatus("메모를 저장했어요.");
    await loadMemos();
  } catch (e2) {
    console.error(e2);
    setStatus("저장에 실패했어요. Firestore 규칙을 확인하세요.", true);
  } finally {
    btn.disabled = false;
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const loggedIn = !!user;
  el.loginBtn.hidden = loggedIn;
  el.logoutBtn.hidden = !loggedIn;
  el.userName.hidden = !loggedIn;
  el.userName.textContent = loggedIn ? (user.displayName || user.email) : "";
  el.form.hidden = !loggedIn;
  el.notice.hidden = loggedIn;
  el.listSection.hidden = !loggedIn;
  if (loggedIn) { setStatus(""); loadMemos(); } else { el.list.replaceChildren(); }
});

el.loginBtn.addEventListener("click", login);
el.logoutBtn.addEventListener("click", () => signOut(auth));
el.form.addEventListener("submit", saveMemo);
el.refresh.addEventListener("click", loadWeather);

loadWeather();
