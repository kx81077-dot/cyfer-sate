import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ============================================================
// 定数
// ============================================================
const LETTERS      = ['C', 'Y', 'F', 'E', 'R'];
const OBJECT_COUNT = LETTERS.length;

// --- 浮遊 — 各文字が「生きている」ように ---
const FLOAT_SPEED   = 0.6;    // 上下ボブ速度
const FLOAT_AMP     = 0.15;   // 上下ボブ振幅
const DRIFT_SPEED   = 0.3;    // 水平ドリフト速度
const DRIFT_AMP     = 0.06;   // 水平ドリフト振幅
const BREATHE_SPEED = 1.8;    // スケール呼吸速度
const BREATHE_AMP   = 0.04;   // スケール呼吸振幅

// --- ヒント脈動 ---
const PULSE_SPEED = 2.5;
const PULSE_MIN   = 0.08;
const PULSE_MAX   = 0.35;

// --- ヒントナッジ（正解オブジェクトが1秒ごとに微かに揺れる） ---
const NUDGE_INTERVAL = 1.0;    // 揺れの発生間隔（秒）
const NUDGE_DURATION = 0.3;    // 揺れの持続時間（秒）
const NUDGE_AMP      = 0.05;   // 揺れ幅（ユニット単位）

// --- タイミング ---
const MOVE_DURATION    = 0.7;
const SCALEUP_DELAY    = 0.3;
const SCALEUP_DURATION = 0.8;
const SCALEUP_TARGET   = 1.6;
const GLITCH_DURATION  = 0.5;

// --- ロゴ待機 — タップするまで呼吸し続ける ---
const LOGO_BREATHE_SPEED = 1.5;
const LOGO_BREATHE_AMP   = 0.025;
const LOGO_BOB_SPEED     = 0.8;
const LOGO_BOB_AMP       = 0.04;
const LOGO_GLOW_MIN      = 0.15;
const LOGO_GLOW_MAX      = 0.45;

// --- ディゾルブ — 3Dがショップに溶け込む ---
const DISSOLVE_DURATION = 2.0;

const FONT_URL = 'https://cdn.jsdelivr.net/npm/three@0.163.0/examples/fonts/helvetiker_bold.typeface.json';

// ============================================================
// オーディオ
// ============================================================
let audioCtx = null;

/** バスクリック — 正解タップ音 */
function playBassClick() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
  const og = audioCtx.createGain();
  og.gain.setValueAtTime(0.5, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(og).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  const len = audioCtx.sampleRate * 0.04;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.25, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  n.connect(ng).connect(audioCtx.destination);
  n.start(now);
}

/** エラーブザー — 不正解タップ音 */
function playErrorBuzz() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/** 和音 — ロゴタップ時の確定音（C-E-G の柔らかい和音） */
function playResolveChord() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  [261.6, 329.6, 392.0].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.05 + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(now + i * 0.04);
    osc.stop(now + 1.8);
  });
}

// ============================================================
// イージング
// ============================================================
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}
function easeInQuad(t) {
  return t * t;
}

// ============================================================
// メイン初期化
// ============================================================
function init() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // DOM参照
  const gamePhase     = document.getElementById('game-phase');
  const shopPhase     = document.getElementById('shop-phase');
  const hudDots       = document.querySelectorAll('.hud-dot');
  const hudEl         = document.getElementById('hud');
  const glitchOverlay = document.getElementById('glitch-overlay');
  const hintEl        = document.getElementById('hint');

  // ============================================================
  // Three.js セットアップ
  // ============================================================
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, vw / vh, 0.1, 100);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(vw, vh);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  gamePhase.prepend(renderer.domElement);

  // フォント読み込み
  new FontLoader().load(FONT_URL, buildScene);

  // 共有マテリアル（ベース — 各オブジェクトでclone）
  const baseWireMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 1,
  });

  const baseGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // 初期位置 — 画面全体に散らばる
  const startPositions = [
    new THREE.Vector3(-1.4,  1.8,  0.5),
    new THREE.Vector3( 1.6,  1.0, -0.3),
    new THREE.Vector3(-1.0, -0.3,  0.8),
    new THREE.Vector3( 0.4, -1.6, -0.5),
    new THREE.Vector3( 1.2, -0.4,  0.3),
  ];

  // ゲーム状態
  const objects         = [];
  const lineupPositions = [];
  let currentStep       = 0;
  let locked            = false;
  let allAligned        = false;
  let scaleUpActive     = false;
  let scaleUpProgress   = 0;
  let logoIdle          = false;   // ロゴ完成→タップ待ち
  let dissolving        = false;   // ディゾルブ中
  let dissolveProgress  = 0;
  let animationId       = null;

  // ============================================================
  // シーン構築（フォント読み込み完了後に呼ばれる）
  // ============================================================
  function buildScene(font) {
    const letterGeoms  = [];
    const letterWidths = [];

    for (let i = 0; i < OBJECT_COUNT; i++) {
      const geom = new TextGeometry(LETTERS[i], {
        font,
        size: 0.8,
        depth: 0.15,
        curveSegments: 3,
        bevelEnabled: false,
      });
      geom.computeBoundingBox();
      geom.center();
      letterWidths.push(geom.boundingBox.max.x - geom.boundingBox.min.x);
      letterGeoms.push(geom);
    }

    // 整列位置を幅に基づいて計算
    const gap = 0.25;
    const totalW = letterWidths.reduce((s, w) => s + w, 0) + gap * (OBJECT_COUNT - 1);
    let xc = -totalW / 2;
    for (let i = 0; i < OBJECT_COUNT; i++) {
      lineupPositions.push(new THREE.Vector3(xc + letterWidths[i] / 2, 0, 0));
      xc += letterWidths[i] + gap;
    }

    // 各文字オブジェクト生成
    for (let i = 0; i < OBJECT_COUNT; i++) {
      const group = new THREE.Group();
      group.position.copy(startPositions[i]);

      // ★ 個別マテリアル（ディゾルブ時に個別フェードするため）
      const wireMat = baseWireMat.clone();
      const mesh = new THREE.Mesh(letterGeoms[i], wireMat);
      group.add(mesh);

      const gGeom = letterGeoms[i].clone();
      gGeom.scale(1.2, 1.2, 1.2);
      const glowMesh = new THREE.Mesh(gGeom, baseGlowMat.clone());
      group.add(glowMesh);

      scene.add(group);

      objects.push({
        group, mesh, glowMesh,
        index: i,
        basePos: startPositions[i].clone(),
        phaseOffset: Math.random() * Math.PI * 2,
        completed: false,
        moving: false,
        moveProgress: 0,
        moveFrom: new THREE.Vector3(),
        moveTo: new THREE.Vector3(),
        glowTimer: 0,
        nudgeTimer: 0,           // ナッジ発生までのカウントダウン
        nudgeActive: 0,          // ナッジ中の経過時間（0=非アクティブ）
        nudgeDirX: 0,            // 揺れ方向X
        nudgeDirY: 0,            // 揺れ方向Y
      });
    }

    renderer.domElement.addEventListener('touchend', onTap, { passive: true });
    renderer.domElement.addEventListener('click', onTap);
    animate();
  }

  // ============================================================
  // タップ検出
  // ============================================================
  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2();

  function onTap(event) {
    // ディゾルブ中は無視
    if (dissolving) return;

    const x = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
    const y = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;
    pointer.x =  (x / window.innerWidth)  * 2 - 1;
    pointer.y = -(y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // ★ ロゴ待機中 — ロゴ全体がタップ対象
    if (logoIdle) {
      const hits = raycaster.intersectObjects(objects.map(o => o.mesh), false);
      if (hits.length > 0) startDissolve();
      return;
    }

    if (locked) return;

    const targets = objects.filter(o => !o.completed).map(o => o.mesh);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return;

    const hitObj = objects.find(o => o.mesh === hits[0].object);
    if (hitObj) handleTap(hitObj);
  }

  // ============================================================
  // ゲームロジック
  // ============================================================
  function handleTap(obj) {
    if (obj.index === currentStep) {
      playBassClick();
      obj.glowTimer = 0.3;
      obj.glowMesh.material.opacity = 0.8;
      obj.completed = true;
      hudDots[currentStep].classList.add('active');
      startMoveToSlot(obj, currentStep);
      currentStep++;
      if (currentStep === OBJECT_COUNT) {
        locked = true;
        hintEl.style.opacity = '0';
      }
    } else {
      playErrorBuzz();
      triggerGlitch();
    }
  }

  // ============================================================
  // 正解 → スロット移動
  // ============================================================
  function startMoveToSlot(obj, slot) {
    obj.moving = true;
    obj.moveProgress = 0;
    obj.moveFrom.copy(obj.group.position);
    obj.moveTo.copy(lineupPositions[slot]);
  }

  function updateMoves(dt) {
    let anyMoving = false;
    for (const obj of objects) {
      if (!obj.moving) continue;
      anyMoving = true;
      obj.moveProgress += dt / MOVE_DURATION;
      const t = Math.min(obj.moveProgress, 1);
      const ease = easeInOutCubic(t);
      obj.group.position.lerpVectors(obj.moveFrom, obj.moveTo, ease);
      const spin = Math.sin(t * Math.PI);
      obj.mesh.rotation.x += dt * (0.5 + spin * 6);
      obj.mesh.rotation.y += dt * (0.5 + spin * 4);
      if (t >= 1) {
        obj.moving = false;
        obj.mesh.rotation.set(0, 0, 0);
        obj.glowMesh.material.opacity = 0.25;
      }
    }
    // 全文字が整列完了 → スケールアップへ
    if (!anyMoving && currentStep === OBJECT_COUNT && !allAligned) {
      allAligned = true;
      setTimeout(() => startScaleUp(), SCALEUP_DELAY * 1000);
    }
  }

  // ============================================================
  // スケールアップ
  // ============================================================
  function startScaleUp() {
    scaleUpActive = true;
    scaleUpProgress = 0;
    for (const obj of objects) obj.glowMesh.material.opacity = 0.5;
  }

  function updateScaleUp(dt) {
    if (!scaleUpActive) return;
    scaleUpProgress += dt / SCALEUP_DURATION;
    const t = Math.min(scaleUpProgress, 1);
    const ease = easeOutQuart(t);

    for (const obj of objects) {
      const s = 0.85 + (SCALEUP_TARGET - 0.85) * ease;
      obj.group.scale.set(s, s, s);
      const tgt = lineupPositions[obj.index];
      obj.group.position.x = tgt.x * (1 + ease * 0.3);
      obj.group.position.y = tgt.y;
      obj.group.position.z = tgt.z;
      obj.glowMesh.material.opacity = 0.25 + ease * 0.55;
    }

    if (t >= 1) {
      scaleUpActive = false;
      // ★ 自動遷移せず、ロゴ待機状態へ
      enterLogoIdle();
    }
  }

  // ============================================================
  // ★ ロゴ待機 — タップされるまで呼吸し続ける
  //
  // ・各文字が微妙にスケール脈動（呼吸）
  // ・微ボブ（文字ごとにずらして波のように）
  // ・グローが穏やかに脈動
  // → ユーザーに「触れる」ことを暗示
  // ============================================================
  function enterLogoIdle() {
    logoIdle = true;
    // HUDドットをフェードアウト（役目を終えた）
    hudEl.style.transition = 'opacity 0.8s';
    hudEl.style.opacity = '0';
  }

  function updateLogoIdle(dt, elapsed) {
    if (!logoIdle || dissolving) return;

    for (const obj of objects) {
      // 呼吸 — スケールが微妙に脈動
      const breathe = 1 + Math.sin(elapsed * LOGO_BREATHE_SPEED + obj.index * 0.3) * LOGO_BREATHE_AMP;
      const s = SCALEUP_TARGET * breathe;
      obj.group.scale.set(s, s, s);

      // 微ボブ — 各文字が波のようにわずかに上下
      const bob = Math.sin(elapsed * LOGO_BOB_SPEED + obj.index * 0.5) * LOGO_BOB_AMP;
      const tgt = lineupPositions[obj.index];
      obj.group.position.x = tgt.x * 1.3;  // スケールアップ後の位置を維持
      obj.group.position.y = tgt.y + bob;

      // グロー脈動 — 触れたくなる光の明滅
      const glow = LOGO_GLOW_MIN + (LOGO_GLOW_MAX - LOGO_GLOW_MIN) *
        (0.5 + 0.5 * Math.sin(elapsed * LOGO_BREATHE_SPEED + obj.index * 0.2));
      obj.glowMesh.material.opacity = glow;
      obj.glowMesh.rotation.copy(obj.mesh.rotation);
    }
  }

  // ============================================================
  // ★ ディゾルブ遷移 — ページリロードなし。3D世界がショップに溶ける
  //
  // タイムライン (0→1 の正規化時間):
  //  0.00: 確定和音。文字のグローが一瞬強く光る
  //  0.00–0.30: グローがフラッシュしてから減衰
  //  0.15–0.70: 各文字がゆっくり上に浮き、個別にフェードアウト（スタガー）
  //  0.25–0.85: game-phase のopacityが 1→0（黒背景ごと溶ける）
  //  0.50: ショップ要素のスタガーアニメーション開始
  //  1.00: Three.js を破棄。ショップのみの世界へ
  // ============================================================
  let shopAnimTriggered = false;

  function startDissolve() {
    if (dissolving) return;
    dissolving = true;
    dissolveProgress = 0;
    logoIdle = false;
    shopAnimTriggered = false;

    playResolveChord();

    // グロー一瞬フラッシュ
    for (const obj of objects) {
      obj.glowMesh.material.opacity = 0.9;
    }

    // ショップフェーズを表示（まだ game-phase の下で見えない）
    shopPhase.classList.add('visible');
    document.body.style.overflow = 'auto';
    document.body.style.touchAction = 'auto';
  }

  function updateDissolve(dt) {
    if (!dissolving) return;

    dissolveProgress += dt / DISSOLVE_DURATION;
    const t = Math.min(dissolveProgress, 1);

    // --- 文字の上昇 ---
    const rise = easeInQuad(Math.min(t / 0.7, 1)) * 1.0;

    for (const obj of objects) {
      const tgt = lineupPositions[obj.index];
      obj.group.position.y = tgt.y + rise;

      // --- 各文字の個別フェードアウト（スタガー） ---
      // 文字ごとに 0.04 ずつ遅延。C→Y→F→E→R の順にゴーストのように消える
      const delay = 0.15 + obj.index * 0.04;
      const fadeEnd = delay + 0.45;
      const fadeT = Math.max(0, Math.min((t - delay) / (fadeEnd - delay), 1));
      obj.mesh.material.opacity = 1 - easeInQuad(fadeT);

      // グロー: 最初のフラッシュから減衰
      const glowFade = Math.max(0, Math.min(t / 0.3, 1));
      obj.glowMesh.material.opacity = 0.9 * (1 - easeOutQuart(glowFade));
    }

    // --- game-phase 全体のopacity ---
    // t=0.25 から t=0.85 でフェードアウト。黒背景ごと溶ける
    const phaseStart = 0.25;
    const phaseEnd   = 0.85;
    const phaseT = Math.max(0, Math.min((t - phaseStart) / (phaseEnd - phaseStart), 1));
    gamePhase.style.opacity = String(1 - easeOutQuart(phaseT));

    // ポインターイベントを先に解放（ショップのスクロールを有効に）
    if (phaseT > 0.3) {
      gamePhase.style.pointerEvents = 'none';
    }

    // --- ショップ要素のスタガーアニメーション開始 ---
    if (t > 0.45 && !shopAnimTriggered) {
      shopAnimTriggered = true;
      animateShopElements();
    }

    // --- 完了 ---
    if (t >= 1) {
      dissolving = false;
      cancelAnimationFrame(animationId);
      renderer.dispose();
      renderer.domElement.remove();
      gamePhase.style.display = 'none';
    }
  }

  // ============================================================
  // ショップ要素のスタガーアニメーション
  // ============================================================
  function animateShopElements() {
    const hero   = document.querySelector('.shop-hero');
    const label  = document.querySelector('.shop-section-label');
    const items  = document.querySelectorAll('.shop-item');
    const footer = document.querySelector('.shop-footer');

    if (hero) requestAnimationFrame(() => hero.classList.add('animate-in'));
    if (label) setTimeout(() => label.classList.add('animate-in'), 150);
    items.forEach((item, i) => {
      setTimeout(() => item.classList.add('animate-in'), 200 + i * 80);
    });
    if (footer) {
      setTimeout(() => footer.classList.add('animate-in'), 200 + items.length * 80 + 100);
    }
  }

  // ============================================================
  // ゲーム中の浮遊 — 各文字が独自の動きで生きている
  // ============================================================
  function updateFloating(dt, elapsed) {
    for (const obj of objects) {
      if (obj.completed || obj.moving) continue;

      const p = obj.phaseOffset;

      // 上下ボブ（各文字で位相がずれて波のように）
      obj.group.position.y = obj.basePos.y +
        Math.sin(elapsed * FLOAT_SPEED + p) * FLOAT_AMP;

      // 水平ドリフト（違う周波数で有機的な揺れ）
      obj.group.position.x = obj.basePos.x +
        Math.sin(elapsed * DRIFT_SPEED + p * 1.7) * DRIFT_AMP;

      // スケール呼吸（膨らんで縮んで…生命感）
      const breathe = 1 + Math.sin(elapsed * BREATHE_SPEED + p * 0.8) * BREATHE_AMP;
      obj.group.scale.set(breathe, breathe, breathe);

      // ゆっくり回転（各文字が独自のペースで）
      obj.mesh.rotation.x += dt * 0.3;
      obj.mesh.rotation.y += dt * 0.5;
      obj.glowMesh.rotation.copy(obj.mesh.rotation);
    }
  }

  // ============================================================
  // ヒント脈動 — 次に押すべき文字をそっと光らせる
  // ============================================================
  function updatePulseHint(elapsed) {
    for (const obj of objects) {
      if (obj.completed || obj.moving) continue;
      if (obj.index === currentStep) {
        const pulse = PULSE_MIN + (PULSE_MAX - PULSE_MIN) *
          (0.5 + 0.5 * Math.sin(elapsed * PULSE_SPEED));
        obj.glowMesh.material.opacity = pulse;
      } else {
        if (obj.glowTimer <= 0) obj.glowMesh.material.opacity = 0;
      }
    }
  }

  // ============================================================
  // ヒントナッジ — 正解オブジェクトだけが1秒ごとに「コクッ」と揺れる
  //
  // 仕組み:
  // ・nudgeTimer がINTERVALに達したらナッジ発動
  // ・発動中は sin カーブで往復（0→ピーク→0）
  // ・揺れ方向はランダム（毎回変わる）
  // ・正解以外のオブジェクトは一切揺れない
  // ============================================================
  function updateNudge(dt) {
    for (const obj of objects) {
      if (obj.completed || obj.moving) continue;

      // 正解オブジェクトのみ処理
      if (obj.index !== currentStep) {
        obj.nudgeTimer = 0;
        obj.nudgeActive = 0;
        continue;
      }

      if (obj.nudgeActive > 0) {
        // --- ナッジ中: sinカーブで滑らかに往復 ---
        obj.nudgeActive += dt;
        const t = obj.nudgeActive / NUDGE_DURATION;

        if (t >= 1) {
          // ナッジ終了 → タイマーリセット
          obj.nudgeActive = 0;
          obj.nudgeTimer = 0;
        } else {
          // sin(π*t) → 0→1→0 の滑らかなカーブ
          const offset = Math.sin(Math.PI * t) * NUDGE_AMP;
          obj.group.position.x += obj.nudgeDirX * offset;
          obj.group.position.y += obj.nudgeDirY * offset;
        }
      } else {
        // --- 待機中: インターバルのカウントダウン ---
        obj.nudgeTimer += dt;
        if (obj.nudgeTimer >= NUDGE_INTERVAL) {
          // ナッジ発動 — ランダムな方向を決定
          const angle = Math.random() * Math.PI * 2;
          obj.nudgeDirX = Math.cos(angle);
          obj.nudgeDirY = Math.sin(angle);
          obj.nudgeActive = 0.001; // 次フレームから開始
        }
      }
    }
  }

  // ============================================================
  // グロー減衰
  // ============================================================
  function updateGlows(dt) {
    for (const obj of objects) {
      if (obj.glowTimer > 0) {
        obj.glowTimer -= dt;
        if (obj.glowTimer <= 0) obj.glowTimer = 0;
      }
    }
  }

  // ============================================================
  // グリッチ → リセット
  // ============================================================
  function triggerGlitch() {
    locked = true;
    glitchOverlay.style.transition = 'none';
    glitchOverlay.style.opacity = '1';

    for (const obj of objects) {
      obj.group.position.x += (Math.random() - 0.5) * 0.8;
      obj.group.position.y += (Math.random() - 0.5) * 0.8;
    }

    setTimeout(() => {
      for (let i = 0; i < OBJECT_COUNT; i++) {
        const obj = objects[i];
        obj.group.position.copy(startPositions[i]);
        obj.basePos.copy(startPositions[i]);
        obj.completed = false;
        obj.moving = false;
        obj.moveProgress = 0;
        obj.glowTimer = 0;
        obj.nudgeTimer = 0;
        obj.nudgeActive = 0;
        obj.glowMesh.material.opacity = 0;
        obj.mesh.material.opacity = 1;
        obj.group.scale.set(1, 1, 1);
        obj.group.visible = true;
        obj.mesh.rotation.set(0, 0, 0);
        hudDots[i].classList.remove('active');
      }
      currentStep = 0;
      allAligned = false;
      scaleUpActive = false;
      scaleUpProgress = 0;

      glitchOverlay.style.transition = 'opacity 0.3s';
      glitchOverlay.style.opacity = '0';
      locked = false;
    }, GLITCH_DURATION * 1000);
  }

  // ============================================================
  // リサイズ
  // ============================================================
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ============================================================
  // メインループ
  //
  // 状態に応じて必要な更新だけを回す
  // - ゲーム中: 浮遊 + 脈動ヒント + 移動 + スケールアップ
  // - ロゴ待機: 呼吸アニメのみ
  // - ディゾルブ: 溶解処理のみ
  // ============================================================
  const clock = new THREE.Clock();

  function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    if (dissolving) {
      // ディゾルブ中はこれだけ
      updateDissolve(dt);
    } else if (logoIdle) {
      // ロゴ待機中は呼吸のみ
      updateLogoIdle(dt, elapsed);
    } else {
      // ゲームプレイ中
      updateFloating(dt, elapsed);
      updateGlows(dt);
      updatePulseHint(elapsed);
      updateNudge(dt);
      updateMoves(dt);
      updateScaleUp(dt);
    }

    renderer.render(scene, camera);
  }
}

// ============================================================
// 起動
// ============================================================
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
