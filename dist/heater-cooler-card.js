/*!
 * Heater Cooler Card for Home Assistant
 * A round wall-thermostat style card with a fire animation while heating,
 * a cold-wind animation while cooling, power on/off and heat/cool switching.
 * MIT License – https://github.com/seggershacoder/Heater-Cooler-Home-Assistant
 */
const HCC_VERSION = '1.0.0';

const HCC_STRINGS = {
  en: {
    heat: 'Heat', cool: 'Cool', target: 'TARGET', off: 'Off', na: 'Unavailable',
    heating: 'Heating', cooling: 'Cooling', idle: 'Idle',
    valve_open: 'valve open', valve_closed: 'valve closed',
    heat_off: 'Heating off', cool_off: 'Cooling off',
    cancel: 'Cancel', confirm: 'Switch',
    ask_house: 'Switch climate mode to “{option}”? This applies to every room.',
    ask_room: 'Switch {name} to {mode}?',
    not_found: 'Entity not found', warmer: 'Warmer', colder: 'Colder', power: 'On/off'
  },
  de: {
    heat: 'Heizen', cool: 'Kühlen', target: 'SOLL', off: 'Aus', na: 'Kein Signal',
    heating: 'Heizt', cooling: 'Kühlt', idle: 'Leerlauf',
    valve_open: 'Ventil offen', valve_closed: 'Ventil zu',
    heat_off: 'Heizung aus', cool_off: 'Kühlung aus',
    cancel: 'Abbrechen', confirm: 'Umstellen',
    ask_house: 'Klimamodus auf „{option}“ umstellen? Das gilt für alle Räume.',
    ask_room: '{name} auf {mode} umstellen?',
    not_found: 'Entität nicht gefunden', warmer: 'Wärmer', colder: 'Kälter', power: 'Ein/Aus'
  }
};

class HeaterCoolerCard extends HTMLElement {
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find((k) => k.startsWith('climate.'));
    return { entity: e || '' };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: 'entity', required: true, selector: { entity: { domain: 'climate' } } },
        { name: 'cool_entity', selector: { entity: { domain: 'climate' } } },
        { name: 'mode_entity', selector: { entity: { domain: ['input_select', 'select'] } } },
        { type: 'grid', name: '', schema: [
          { name: 'heat_option', selector: { text: {} } },
          { name: 'cool_option', selector: { text: {} } }
        ] },
        { type: 'grid', name: '', schema: [
          { name: 'name', selector: { text: {} } },
          { name: 'name_position', selector: { select: { mode: 'dropdown', options: ['inside', 'top'] } } }
        ] },
        { type: 'grid', name: '', schema: [
          { name: 'step', selector: { number: { min: 0.1, max: 1, step: 0.1, mode: 'box' } } },
          { name: 'size', selector: { number: { min: 160, max: 520, step: 10, mode: 'box' } } }
        ] },
        { type: 'grid', name: '', schema: [
          { name: 'show_valve', selector: { boolean: {} } },
          { name: 'confirm', selector: { boolean: {} } }
        ] },
        { name: 'demo', selector: { select: { mode: 'dropdown', options: ['', 'heat', 'cool'] } } }
      ]
    };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error('Please define a climate entity (entity)');
    this._c = config;
    if (this._built) {
      this._e.dial.style.setProperty('--sz', (Number(config.size) || 340) + 'px');
      this._upd();
    }
  }

  getCardSize() { return 6; }
  getGridOptions() { return { columns: 6, rows: 'auto', min_columns: 3 }; }

  set hass(hass) {
    this._h = hass;
    if (!this._built) this._build();
    this._upd();
  }

  _t(key, vars) {
    const lang = ((this._h && this._h.locale && this._h.locale.language) || 'en').slice(0, 2);
    let s = (HCC_STRINGS[lang] || HCC_STRINGS.en)[key] || HCC_STRINGS.en[key] || key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
    return s;
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const R = 80.5, C = 2 * Math.PI * R;
    this._C = C; this._R = R;
    const flames = [[12, 22, 40, 0.15, 1.1], [26, 22, 58, 0.45, 0.95], [38, 26, 74, 0, 0.8], [53, 22, 60, 0.3, 1.0], [66, 22, 42, 0.6, 1.15]]
      .map(([l, w, h, d, t]) => `<div class="fl" style="left:${l}%;width:${w}%;height:${h}%;animation-delay:${d}s;animation-duration:${t}s"></div>`).join('');
    const embers = [[34, -4, 0], [44, 5, 0.7], [52, -3, 1.3], [60, 6, 1.9], [48, 1, 0.4], [40, -6, 2.2]]
      .map(([l, dx, d]) => `<i style="left:${l}%;--dx:${dx}cqw;animation-delay:${d}s"></i>`).join('');
    const gusts = [[24, 2.6, 0, 38], [36, 3.1, 0.9, 46], [47, 2.3, 1.6, 30], [58, 2.9, 0.4, 42], [69, 3.4, 1.2, 34], [80, 2.7, 2.0, 28]]
      .map(([y, t, d, w]) => `<b style="top:${y}%;width:${w}%;--t:${t}s;--d:${d}s"></b>`).join('');
    const snow = [[18, 3.6, 0], [32, 4.2, 1.1], [46, 3.2, 0.5], [60, 4.6, 1.8], [74, 3.9, 2.4], [40, 5.0, 3.0]]
      .map(([y, t, d]) => `<s style="top:${y}%;--t:${t}s;--d:${d}s"></s>`).join('');

    root.innerHTML = `<style>
      :host{--hcc-heat:#ff6a2a;--hcc-cool:#3d9bff;--hcc-idle:#9ccc3c}
      ha-card{padding:16px 10px;overflow:hidden}
      .hd{display:none;font-size:16px;font-weight:600;line-height:1.3;text-align:center;margin:-4px 4px 10px;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
      .top-name .hd{display:block}.top-name .nm{display:none}.top-name .modes{margin-bottom:1.6cqw}
      .dial{--sz:340px;position:relative;width:min(100%,var(--sz));aspect-ratio:1;margin:0 auto;border-radius:50%;container-type:inline-size;background:radial-gradient(circle closest-side,#2a2a2c 0 74%,#161617 80%,#0c0c0d 87%);box-shadow:0 12px 30px rgba(0,0,0,.55);font-family:var(--ha-font-family-body,Roboto,sans-serif);user-select:none;-webkit-user-select:none}
      .kn{position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(#121212 0deg 2deg,#a2a2a2 2.6deg 3.2deg,#3c3c3c 3.8deg 6deg);-webkit-mask:radial-gradient(circle closest-side,transparent 0 87%,#000 87.5%);mask:radial-gradient(circle closest-side,transparent 0 87%,#000 87.5%)}
      .kn::after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 25%,rgba(255,255,255,.22),rgba(0,0,0,.6) 80%)}
      svg.arc{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
      .trk{fill:none;stroke:#2b2b2d;stroke-width:5;stroke-linecap:round}
      .val{fill:none;stroke:#666;stroke-width:5;stroke-linecap:round;transition:stroke .6s}
      .heat .val{stroke:var(--hcc-heat)}.cool .val{stroke:var(--hcc-cool)}.off .val,.na .val{stroke:#555}
      .heat-on .val{filter:drop-shadow(0 0 3px var(--hcc-heat))}.cool-on .val{filter:drop-shadow(0 0 3px var(--hcc-cool))}
      .knob{fill:#f4f4f4;stroke:#000;stroke-width:1.5}
      .hit{fill:none;stroke:transparent;stroke-width:20;pointer-events:stroke;cursor:grab;touch-action:none}
      .face{position:absolute;inset:13%;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#1b1b1c,#050505 72%);box-shadow:inset 0 0 0 2px #000,inset 0 8px 22px rgba(0,0,0,.9),0 0 0 3px #262628}
      .fire{position:absolute;left:0;right:0;bottom:0;height:62%;opacity:0;transition:opacity 1.2s;pointer-events:none}
      .heat-on .fire{opacity:.9}
      .glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 100%,rgba(255,110,20,.6),transparent 68%);animation:hcc-pulse 1.8s ease-in-out infinite alternate}
      .fl{position:absolute;bottom:-8%;border-radius:50% 50% 45% 45%/62% 62% 38% 38%;background:radial-gradient(ellipse at 50% 85%,#fffbe0 0%,#ffd23f 20%,#ff8a00 46%,rgba(255,60,0,.6) 66%,rgba(255,40,0,0) 78%);filter:blur(1.4px);mix-blend-mode:screen;transform-origin:50% 100%;animation:hcc-flick 1s ease-in-out infinite alternate}
      .fire i{position:absolute;bottom:22%;width:1.1cqw;height:1.1cqw;border-radius:50%;background:#ffc061;box-shadow:0 0 1.2cqw #ff9b2f;opacity:0;animation:hcc-ember 2.6s linear infinite}
      @keyframes hcc-flick{0%{transform:scaleY(1) scaleX(1) skewX(0)}30%{transform:scaleY(1.14) scaleX(.9) skewX(3deg)}60%{transform:scaleY(.9) scaleX(1.06) skewX(-3deg)}100%{transform:scaleY(1.07) scaleX(.96) skewX(2deg)}}
      @keyframes hcc-pulse{from{opacity:.7}to{opacity:1}}
      @keyframes hcc-ember{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--dx),-30cqw);opacity:0}}
      .wind{position:absolute;inset:0;opacity:0;transition:opacity 1.2s;pointer-events:none}
      .cool-on .wind{opacity:1}
      .cold{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle closest-side,transparent 55%,rgba(61,155,255,.42) 100%);animation:hcc-pulse 2.4s ease-in-out infinite alternate}
      .wind b{position:absolute;left:-45%;height:.7cqw;border-radius:1cqw;background:linear-gradient(90deg,transparent,rgba(170,220,255,.9),transparent);opacity:0;animation:hcc-gust var(--t) linear infinite;animation-delay:var(--d)}
      .wind s{position:absolute;left:-4%;width:1.1cqw;height:1.1cqw;border-radius:50%;background:#e8f6ff;box-shadow:0 0 1cqw #bfe3ff;opacity:0;animation:hcc-drift var(--t) linear infinite;animation-delay:var(--d)}
      @keyframes hcc-gust{0%{transform:translate(0,0);opacity:0}15%{opacity:1}55%{transform:translate(70cqw,-1.2cqw)}100%{transform:translate(135cqw,.8cqw);opacity:0}}
      @keyframes hcc-drift{0%{transform:translate(0,0) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(80cqw,7cqw) rotate(180deg);opacity:0}}
      .ui{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding-top:6.5cqw;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9)}
      .modes{display:flex;gap:2cqw;height:8cqw}
      .modes button{width:8cqw;height:8cqw}
      .modes ha-icon{--mdc-icon-size:4.6cqw}
      .modes .on.h{background:var(--hcc-heat);color:#fff}.modes .on.c{background:var(--hcc-cool);color:#fff}
      .nm{margin-top:1.4cqw;font-size:3.6cqw;letter-spacing:.12em;text-transform:uppercase;color:#a9b4bf;max-width:44cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
      .cur{font-size:17cqw;font-weight:300;line-height:1;margin-top:.6cqw;cursor:pointer;letter-spacing:-.02em}
      .cur sup{font-size:5cqw;vertical-align:top;margin-left:.6cqw;position:relative;top:2cqw}
      .ln{width:34cqw;height:.55cqw;border-radius:1cqw;background:var(--hcc-idle);margin:1.2cqw 0;transition:background .6s}
      .heat-on .ln{background:var(--hcc-heat)}.cool-on .ln{background:var(--hcc-cool)}.off .ln,.na .ln{background:#555}
      .soll{display:flex;align-items:baseline;gap:1.4cqw;font-size:6cqw}
      .soll small{font-size:2.6cqw;letter-spacing:.1em;color:#aaa}
      .st{font-size:3.4cqw;color:#bbb;margin-top:.8cqw;white-space:nowrap;max-width:50cqw;overflow:hidden;text-overflow:ellipsis}
      .heat-on .st{color:#ffb38a}.cool-on .st{color:#a9d4ff}
      .btns{display:flex;gap:3cqw;margin-top:2.4cqw}
      button{all:unset;box-sizing:border-box;cursor:pointer;width:10.5cqw;height:10.5cqw;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(40,40,42,.85);color:#eee;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);transition:transform .1s,background .4s,color .4s}
      button ha-icon{--mdc-icon-size:5.6cqw}
      button:active{transform:scale(.9)}
      button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
      .pw.on{color:#fff;background:rgba(80,80,84,.95)}.heat .pw.on{background:var(--hcc-heat)}.cool .pw.on{background:var(--hcc-cool)}
      .off .cur,.off .soll,.na .cur{opacity:.45}.off .pm,.na .pm{opacity:.35;pointer-events:none}
      .cf{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;gap:3.5cqw;text-align:center;padding:12cqw;font-size:4.2cqw;color:#fff;line-height:1.35}
      .cf.show{display:flex}
      .cf .row{display:flex;gap:3cqw}
      .cf button{width:auto;height:auto;border-radius:4cqw;padding:2cqw 4.5cqw;font-size:3.8cqw;font-weight:600}
      .cf .ok{background:var(--hcc-cool)}.cf .ok.h{background:var(--hcc-heat)}
      .err{padding:12px;color:var(--error-color,#db4437)}
      @media (prefers-reduced-motion:reduce){.fl,.glow,.fire i,.cold,.wind b,.wind s{animation:none!important}.cool-on .wind b{opacity:.6;transform:translateX(60cqw)}}
    </style>
    <ha-card><div class="hd"></div><div class="dial">
      <div class="kn"></div>
      <svg class="arc" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="trk" cx="100" cy="100" r="${R}" transform="rotate(135 100 100)" stroke-dasharray="${(0.75 * C).toFixed(2)} ${C.toFixed(2)}"/>
        <circle class="val" cx="100" cy="100" r="${R}" transform="rotate(135 100 100)" stroke-dasharray="0 ${C.toFixed(2)}"/>
        <circle class="hit" cx="100" cy="100" r="${R}" transform="rotate(135 100 100)" stroke-dasharray="${(0.75 * C).toFixed(2)} ${C.toFixed(2)}"/>
        <circle class="knob" r="5.5" cx="100" cy="100"/>
      </svg>
      <div class="face">
        <div class="fire"><div class="glow"></div>${flames}${embers}</div>
        <div class="wind"><div class="cold"></div>${gusts}${snow}</div>
        <div class="ui">
          <div class="modes"><button class="h"><ha-icon icon="mdi:fire"></ha-icon></button><button class="c"><ha-icon icon="mdi:snowflake"></ha-icon></button></div>
          <div class="nm"></div>
          <div class="cur"></div>
          <div class="ln"></div>
          <div class="soll"><small class="tl"></small><span class="sv"></span></div>
          <div class="st"></div>
          <div class="btns"><button class="mn pm"><ha-icon icon="mdi:minus"></ha-icon></button><button class="pw"><ha-icon icon="mdi:power"></ha-icon></button><button class="pl pm"><ha-icon icon="mdi:plus"></ha-icon></button></div>
        </div>
        <div class="cf"><div class="cft"></div><div class="row"><button class="no"></button><button class="ok"></button></div></div>
      </div>
    </div></ha-card>`;

    const q = (s) => root.querySelector(s);
    this._e = {
      hd: q('.hd'), dial: q('.dial'), card: q('ha-card'), val: q('.val'), knob: q('.knob'), hit: q('.hit'),
      nm: q('.nm'), cur: q('.cur'), sv: q('.sv'), tl: q('.tl'), st: q('.st'), pw: q('.pw'), mn: q('.mn'), pl: q('.pl'),
      mh: q('.modes .h'), mc: q('.modes .c'), modes: q('.modes'), cf: q('.cf'), cft: q('.cft'), ok: q('.cf .ok'), no: q('.cf .no')
    };
    this._e.dial.style.setProperty('--sz', (Number(this._c.size) || 340) + 'px');

    const info = () => {
      const x = this._ctx();
      this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: x.id } }));
    };
    this._e.nm.onclick = info; this._e.cur.onclick = info; this._e.hd.onclick = info;
    this._e.mn.onclick = () => this._step(-1);
    this._e.pl.onclick = () => this._step(1);
    this._e.pw.onclick = () => this._power();
    this._e.mh.onclick = () => this._ask('heat');
    this._e.mc.onclick = () => this._ask('cool');
    this._e.no.onclick = () => this._e.cf.classList.remove('show');
    this._e.ok.onclick = () => { this._e.cf.classList.remove('show'); this._switch(this._askTo); };

    const svg = q('svg.arc'), hit = this._e.hit;
    const fromEvent = (ev) => {
      const b = svg.getBoundingClientRect();
      const a = Math.atan2(ev.clientY - b.top - b.height / 2, ev.clientX - b.left - b.width / 2) * 180 / Math.PI;
      let rel = (a - 135 + 720) % 360;
      if (rel > 270) rel = rel > 315 ? 0 : 270;
      return rel / 270;
    };
    hit.addEventListener('pointerdown', (ev) => {
      const x = this._ctx();
      if (!x.s || x.s.state === 'off') return;
      this._drag = true;
      hit.setPointerCapture(ev.pointerId);
      this._setFraction(fromEvent(ev));
      ev.preventDefault();
    });
    hit.addEventListener('pointermove', (ev) => { if (this._drag) this._setFraction(fromEvent(ev)); });
    const end = () => { if (!this._drag) return; this._drag = false; this._send(400); };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
    this._built = true;
  }

  // Works out which thermostat is in charge and how heat/cool switching works.
  // kind: 'house' = select helper switches the whole house, 'room' = separate heat and cool
  // thermostats switched per room, 'single' = one thermostat with heat and cool modes, 'none'.
  _ctx() {
    const c = this._c, h = this._h;
    const heat = h.states[c.entity];
    const cool = c.cool_entity ? h.states[c.cool_entity] : null;
    const me = c.mode_entity ? h.states[c.mode_entity] : null;
    let mode = 'heat', kind = 'none';
    if (cool && me) {
      kind = 'house';
      mode = me.state === this._option('cool', me) ? 'cool' : 'heat';
    } else if (cool) {
      kind = 'room';
      const live = (s) => s && !['off', 'unavailable', 'unknown'].includes(s.state);
      mode = live(cool) && !live(heat) ? 'cool' : 'heat';
    } else if (heat) {
      const modes = heat.attributes.hvac_modes || [];
      if (modes.includes('heat') && modes.includes('cool')) {
        kind = 'single';
        if (heat.state === 'cool' || heat.state === 'heat') this._last = heat.state;
        mode = this._last || 'heat';
      }
    }
    if (c.demo === 'cool' && kind !== 'house') mode = 'cool';
    const id = mode === 'cool' && cool ? c.cool_entity : c.entity;
    return { mode, id, s: h.states[id], me, kind };
  }

  _option(which, me) {
    const o = (me && me.attributes.options) || [];
    if (which === 'cool') return this._c.cool_option || ['Sommer', 'Summer', 'Cool', 'Kühlen'].find((x) => o.includes(x)) || o[1];
    return this._c.heat_option || ['Winter', 'Heat', 'Heizen'].find((x) => o.includes(x)) || o[0];
  }

  _fmt(v) {
    const n = Number(v);
    if (v === null || v === undefined || v === '' || isNaN(n)) return '–';
    return n.toLocaleString((this._h.locale && this._h.locale.language) || 'en', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  _unit() { return (this._h.config && this._h.config.unit_system && this._h.config.unit_system.temperature) || '°C'; }

  _limits(s) {
    const A = s.attributes;
    return [Number(A.min_temp ?? 5), Number(A.max_temp ?? 30)];
  }

  _stepSize() { return Number(this._c.step) || 0.5; }

  _setFraction(f) {
    const x = this._ctx(); if (!x.s) return;
    const [lo, hi] = this._limits(x.s), st = this._stepSize();
    let v = Math.round((lo + f * (hi - lo)) / st) * st;
    v = Math.min(hi, Math.max(lo, v));
    this._pend = Math.round(v * 10) / 10; this._pendT = Date.now() + 3000;
    this._upd();
  }

  _send(ms) {
    clearTimeout(this._tm);
    this._tm = setTimeout(() => {
      const x = this._ctx();
      if (!x.s || this._pend === undefined) return;
      this._pendT = Date.now();
      this._h.callService('climate', 'set_temperature', { entity_id: x.id, temperature: this._pend });
    }, ms);
  }

  _step(dir) {
    const x = this._ctx(); if (!x.s || x.s.state === 'off') return;
    const [lo, hi] = this._limits(x.s), st = this._stepSize();
    const base = this._pend !== undefined ? this._pend : Number(x.s.attributes.temperature);
    let v = Math.round((base + dir * st) / st) * st;
    v = Math.min(hi, Math.max(lo, v));
    this._pend = Math.round(v * 10) / 10; this._pendT = Date.now() + 3000;
    this._upd(); this._send(900);
  }

  _power() {
    const x = this._ctx(); if (!x.s) return;
    const modes = x.s.attributes.hvac_modes || [];
    const want = x.mode === 'cool' ? 'cool' : 'heat';
    const to = x.s.state === 'off' ? (modes.includes(want) ? want : modes.find((m) => m !== 'off')) : 'off';
    if (to) this._h.callService('climate', 'set_hvac_mode', { entity_id: x.id, hvac_mode: to });
  }

  _ask(to) {
    const x = this._ctx();
    if (x.kind === 'none' || x.mode === to) return;
    this._askTo = to;
    if (x.kind === 'single' || this._c.confirm === false) { this._switch(to); return; }
    const name = this._c.name || (this._h.states[this._c.entity] && this._h.states[this._c.entity].attributes.friendly_name) || this._c.entity;
    this._e.cft.textContent = x.kind === 'house'
      ? this._t('ask_house', { option: this._option(to, x.me) })
      : this._t('ask_room', { name, mode: this._t(to) });
    this._e.ok.classList.toggle('h', to === 'heat');
    this._e.cf.classList.add('show');
  }

  async _switch(to) {
    const x = this._ctx(), c = this._c, h = this._h;
    if (!to || x.kind === 'none') return;
    if (x.kind === 'house') {
      await h.callService(c.mode_entity.split('.')[0], 'select_option', { entity_id: c.mode_entity, option: this._option(to, x.me) });
    } else if (x.kind === 'room') {
      // Turn the other side off first so both thermostats never drive the same valve.
      const offId = to === 'cool' ? c.entity : c.cool_entity;
      const onId = to === 'cool' ? c.cool_entity : c.entity;
      await h.callService('climate', 'set_hvac_mode', { entity_id: offId, hvac_mode: 'off' });
      await h.callService('climate', 'set_hvac_mode', { entity_id: onId, hvac_mode: to });
    } else if (x.kind === 'single') {
      this._last = to;
      await h.callService('climate', 'set_hvac_mode', { entity_id: c.entity, hvac_mode: to });
    }
  }

  _upd() {
    if (!this._built || !this._h || !this._c) return;
    const e = this._e, c = this._c, x = this._ctx(), s = x.s;
    e.mh.setAttribute('aria-label', this._t('heat')); e.mc.setAttribute('aria-label', this._t('cool'));
    e.mn.setAttribute('aria-label', this._t('colder')); e.pl.setAttribute('aria-label', this._t('warmer'));
    e.pw.setAttribute('aria-label', this._t('power'));
    e.no.textContent = this._t('cancel'); e.ok.textContent = this._t('confirm'); e.tl.textContent = this._t('target');
    if (!s) {
      e.card.className = 'na';
      e.nm.textContent = e.hd.textContent = this._t('not_found');
      e.st.textContent = x.id;
      return;
    }
    const A = s.attributes;
    const na = ['unavailable', 'unknown'].includes(s.state), off = s.state === 'off';
    const act = A.hvac_action;
    let anim = c.demo || (act === 'heating' || act === 'preheating' ? 'heat' : act === 'cooling' ? 'cool' : null);
    if ((na || off) && !c.demo) anim = null;

    e.card.className = [x.mode, anim ? anim + '-on' : '', off ? 'off' : '', na ? 'na' : '', c.name_position === 'top' ? 'top-name' : ''].join(' ');
    e.modes.style.display = x.kind === 'none' ? 'none' : '';
    e.mh.classList.toggle('on', x.mode === 'heat');
    e.mc.classList.toggle('on', x.mode === 'cool');

    const name = c.name || (this._h.states[c.entity] && this._h.states[c.entity].attributes.friendly_name) || c.entity;
    e.nm.textContent = name; e.hd.textContent = name;
    e.cur.innerHTML = this._fmt(A.current_temperature) + '<sup>' + this._unit() + '</sup>';

    if (this._pend !== undefined && !this._drag && (Math.abs(Number(A.temperature) - this._pend) < 0.01 || Date.now() - this._pendT > 6000)) this._pend = undefined;
    const target = this._pend !== undefined ? this._pend : Number(A.temperature);
    e.sv.textContent = off ? this._t('off') : this._fmt(target) + ' ' + this._unit();

    const valve = c.show_valve ? (anim ? ' · ' + this._t('valve_open') : ' · ' + this._t('valve_closed')) : '';
    e.st.textContent = na ? this._t('na')
      : off ? this._t(x.mode === 'cool' ? 'cool_off' : 'heat_off')
      : anim === 'heat' ? this._t('heating') + valve
      : anim === 'cool' ? this._t('cooling') + valve
      : this._t('idle') + valve;
    e.pw.classList.toggle('on', !off && !na);

    const [lo, hi] = this._limits(s);
    const f = isNaN(target) || hi <= lo ? 0 : Math.min(1, Math.max(0, (target - lo) / (hi - lo)));
    e.val.setAttribute('stroke-dasharray', (f * 0.75 * this._C).toFixed(2) + ' ' + this._C.toFixed(2));
    const a = (135 + f * 270) * Math.PI / 180;
    e.knob.setAttribute('cx', (100 + this._R * Math.cos(a)).toFixed(2));
    e.knob.setAttribute('cy', (100 + this._R * Math.sin(a)).toFixed(2));
    e.knob.style.display = off || na ? 'none' : '';
  }
}

if (!customElements.get('heater-cooler-card')) customElements.define('heater-cooler-card', HeaterCoolerCard);
// Alias for configurations created before the public release.
if (!customElements.get('klima-dial-card')) customElements.define('klima-dial-card', class extends HeaterCoolerCard {});

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === 'heater-cooler-card')) {
  window.customCards.push({
    type: 'heater-cooler-card',
    name: 'Heater Cooler Card',
    description: 'Round thermostat dial with fire and cold-wind animations, on/off and heat/cool switching.',
    preview: true,
    documentationURL: 'https://github.com/seggershacoder/Heater-Cooler-Home-Assistant'
  });
}

console.info(`%c HEATER-COOLER-CARD %c v${HCC_VERSION} `, 'color:#fff;background:#ff6a2a;font-weight:700', 'color:#ff6a2a;background:#1b1b1c');
