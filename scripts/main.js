/**
 * fvtt-character-md-export — main.js
 * Экспорт листа персонажа D&D 5e в Markdown.
 * Совместимо: FoundryVTT v12–v14 (AppV1 + Application V2)
 */

// ── Утилиты ──────────────────────────────────────────────────────────────────
function mod(v){ const m=Math.floor((v-10)/2); return m>=0?`+${m}`:`${m}`; }
function abilityStr(v){ return `${v} (${mod(v)})`; }

/** Вырезает &reference[key]{текст} → текст, затем чистит HTML-теги */
function stripHtml(html){
  if(!html) return "";
  return html
    .replace(/&reference\[[^\]]*\]\{([^}]+)\}/g, '$1')
    .replace(/<\/p>/gi,"\n").replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/li>/gi,"\n").replace(/<li>/gi,"- ")
    .replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/\n{3,}/g,"\n\n").trim();
}

/** Берёт первое предложение из текста, но не более maxLen символов */
function firstSentence(text, maxLen = 200){
  if(!text) return "";
  const m = text.match(/^.+?[.!?](?:\s|$)/s);
  const sentence = m ? m[0].trim() : text;
  return sentence.length > maxLen ? sentence.slice(0, maxLen).trimEnd() + "…" : sentence;
}

function profBonus(lvl){ return Math.ceil(lvl/4)+1; }
function skillBonus(abilVal,profVal,pb){
  const base=Math.floor((abilVal-10)/2);
  const add=profVal===2?pb*2:profVal===1?pb:0;
  const t=base+add; return (t>=0?`+${t}`:`${t}`)+(profVal>0?" ✓":"");
}

const ABILITY_RU={str:"СИЛ",dex:"ЛВК",con:"ВЫН",int:"ИНТ",wis:"МДР",cha:"ХАР"};
const SKILL_RU={
  acr:"Акробатика",ani:"Уход за жив.",arc:"Магия",ath:"Атлетика",
  dec:"Обман",his:"История",ins:"Проницательн.",itm:"Запугивание",
  inv:"Анализ",med:"Медицина",nat:"Природа",prc:"Восприятие",
  prf:"Выступление",per:"Убеждение",rel:"Религия",slt:"Ловкость рук",
  ste:"Скрытность",sur:"Выживание"
};
const SKILL_ABILITY={
  acr:"dex",ani:"wis",arc:"int",ath:"str",dec:"cha",his:"int",
  ins:"wis",itm:"cha",inv:"int",med:"wis",nat:"int",prc:"wis",
  prf:"cha",per:"cha",rel:"int",slt:"dex",ste:"dex",sur:"wis"
};
const SPELL_SCHOOL_RU={
  abj:"Ограждение",con:"Вызов",div:"Прорицание",enc:"Очарование",
  evo:"Воплощение",ill:"Иллюзия",nec:"Некромантия",trs:"Преобразование"
};

const LANGUAGE_RU={
  common:       "Всеобщий",
  dwarvish:     "Дварфийский",
  elvish:       "Эльфийский",
  giant:        "Великанский",
  gnomish:      "Гномий",
  goblin:       "Гоблинский",
  halfling:     "Полуросликовый",
  orc:          "Орочий",
  abyssal:      "Бездны",
  celestial:    "Небесный",
  draconic:     "Драконий",
  deepSpeech:   "Глубинная речь",
  infernal:     "Дьявольский",
  primordial:   "Первородный",
  sylvan:       "Сильванский",
  undercommon:  "Подземный",
  cant:         "Воровской жаргон",
  druidic:      "Друидический",
  gith:         "Гитский",
  gnoll:        "Гноллий",
  thri:         "Тирийский",
  aarakocra:    "Ааракокра",
  aquan:        "Акван",
  auran:        "Ауран",
  ignan:        "Игнан",
  terran:       "Терран",
  troglodyte:   "Троглодитский",
};

function langName(key){
  return LANGUAGE_RU[key] ?? LANGUAGE_RU[key?.toLowerCase()] ?? key;
}

// ── Генерация Markdown ───────────────────────────────────────────────────────
function generateMarkdown(actor){
  const s=actor.system, items=actor.items.contents;
  const classItems=items.filter(i=>i.type==="class");
  const subclassItems=items.filter(i=>i.type==="subclass");
  const totalLevel=classItems.reduce((sum,c)=>sum+(c.system.levels||0),0)||s.details?.level||1;
  const classStr=classItems.map(c=>{
    const sub=subclassItems.find(sc=>sc.system?.classIdentifier===c.system?.identifier);
    return sub?`${c.name} (${sub.name}) ${c.system.levels}`:`${c.name} ${c.system.levels}`;
  }).join(", ");
  const pb=profBonus(totalLevel), ab=s.abilities;
  const raceItem=items.find(i=>i.type==="race");
  const raceName=raceItem?raceItem.name:(s.details?.race||"—");
  const bgItem=items.find(i=>i.type==="background");
  const bgName=bgItem?bgItem.name:"—";

  const langs=(s.traits?.languages?.value||[]).map(langName);
  const langCustom=s.traits?.languages?.custom||"";
  const langStr=[...langs,...(langCustom?langCustom.split(";"):[])].map(l=>l.trim()).filter(Boolean).join(", ")||"—";

  const hp=s.attributes?.hp, ac=s.attributes?.ac?.value??"?";
  const mv=s.attributes?.movement, speedStr=mv?.walk?`${mv.walk} фут.`:"30 фут.";
  const prcVal=s.skills?.prc?.value??0;
  const passivePerc=10+Math.floor((ab.wis.value-10)/2)+(prcVal===2?pb*2:prcVal===1?pb:0);
  const initBonus=Math.floor((ab.dex.value-10)/2);
  const initStr=initBonus>=0?`+${initBonus}`:`${initBonus}`;
  const abilityHeader=Object.keys(ABILITY_RU).map(k=>ABILITY_RU[k]).join(" | ");
  const abilitySep=Object.keys(ABILITY_RU).map(()=>"-----").join(" | ");
  const abilityVals=Object.keys(ABILITY_RU).map(k=>abilityStr(ab[k]?.value??10)).join(" | ");
  const saveVals=Object.keys(ABILITY_RU).map(k=>skillBonus(ab[k]?.value??10,ab[k]?.proficient??0,pb)).join(" | ");
  const skillLines=Object.entries(SKILL_RU).map(([key,ruName])=>{
    const abilKey=SKILL_ABILITY[key], abilVal=ab[abilKey]?.value??10, profVal=s.skills?.[key]?.value??0;
    return `${ruName} (${ABILITY_RU[abilKey]}): ${skillBonus(abilVal,profVal,pb)}`;
  });
  const profSkills=skillLines.filter(l=>l.includes("✓"));
  const otherSkills=skillLines.filter(l=>!l.includes("✓"));
  const raceFeats=items.filter(i=>i.type==="feat"&&(i.system?.type?.value==="race"||(raceItem&&i.flags?.dnd5e?.sourceItem?.identifier===raceItem.system?.identifier)));
  const classFeats=items.filter(i=>i.type==="feat"&&(i.system?.type?.value==="class"||classItems.some(c=>i.system?.requirements?.toLowerCase().includes(c.name.toLowerCase())))&&!raceFeats.includes(i));
  const otherFeats=items.filter(i=>i.type==="feat"&&!raceFeats.includes(i)&&!classFeats.includes(i));
  const weapons=items.filter(i=>i.type==="weapon");
  const armors=items.filter(i=>i.type==="equipment");
  const consumables=items.filter(i=>i.type==="consumable");
  const loot=items.filter(i=>i.type==="loot");
  const otherItems=items.filter(i=>!["weapon","equipment","consumable","container","loot","class","subclass","race","background","feat","spell"].includes(i.type));
  const cur=s.currency||{};
  const curStr=[cur.pp&&`${cur.pp} пз`,cur.gp&&`${cur.gp} зм`,cur.ep&&`${cur.ep} эм`,cur.sp&&`${cur.sp} сз`,cur.cp&&`${cur.cp} мз`].filter(Boolean).join(", ")||"—";
  const spells=items.filter(i=>i.type==="spell");
  const spellSlots=s.spells||{};
  const scAbility=s.attributes?.spellcasting||"int";
  const scAb=ab[scAbility]?.value??10;
  const spellDC=8+pb+Math.floor((scAb-10)/2), spellAtk=pb+Math.floor((scAb-10)/2);
  const cantripSpells=spells.filter(sp=>sp.system?.level===0&&sp.system?.preparation?.mode!=="innate");
  const slottedSpells=spells.filter(sp=>sp.system?.level>0&&sp.system?.preparation?.mode!=="innate");
  const byLevel={}; slottedSpells.forEach(sp=>{const l=sp.system.level;if(!byLevel[l])byLevel[l]=[];byLevel[l].push(sp);});
  const slotRows=[];
  for(let i=1;i<=9;i++){const slot=spellSlots[`spell${i}`];if(slot?.max>0)slotRows.push(`| ${i}-й | ${slot.max} | ${slot.value??0} |`);}
  const det=s.details||{}, L=[];
  L.push(`# ${actor.name}`,"");
  L.push("## Общие сведения");
  L.push(`**Пол:** ${det.gender||"—"}  `,`**Раса:** ${raceName}  `,`**Происхождение:** ${bgName}  `,`**Уровень:** ${totalLevel}  `,`**Класс:** ${classStr||"—"}  `,`**Языки:** ${langStr}  `,"");
  L.push("## Боевые характеристики");
  L.push(`**HP:** ${hp?.value??"?"}/${hp?.max??"?"} | **Временные HP:** ${hp?.temp??0}  `,`**КБ:** ${ac}  `,`**Скорость:** ${speedStr}  `,`**Пасс. внимательность:** ${passivePerc}  `,`**Бонус мастерства:** +${pb}  `,`**Инициатива:** ${initStr}  `,"");
  L.push("## Характеристики",`| ${abilityHeader} |`,`| ${abilitySep} |`,`| ${abilityVals} |`,"");
  L.push("### Спасброски",`| ${abilityHeader} |`,`| ${abilitySep} |`,`| ${saveVals} |`,"*(✓ — владение)*","");
  L.push("### Навыки");
  if(profSkills.length){L.push("**Владение:**");profSkills.forEach(l=>L.push(`- ${l}`));}
  L.push("**Остальные:**"); otherSkills.forEach(l=>L.push(`- ${l}`)); L.push("");
  if(raceFeats.length){L.push("## Особенности расы");raceFeats.forEach(f=>{L.push(`### ${f.name}`);const d=stripHtml(f.system?.description?.value);if(d)L.push(d);L.push("");});}
  if(classFeats.length){L.push("## Особенности класса");classFeats.forEach(f=>{L.push(`### ${f.name}`);const d=stripHtml(f.system?.description?.value);if(d)L.push(d);if(f.system?.uses?.max)L.push(`*Исп.: ${f.system.uses.max-(f.system.uses.spent||0)}/${f.system.uses.max}*`);L.push("");});}
  if(otherFeats.length){
    L.push("## Прочие черты");
    otherFeats.forEach(f=>{
      L.push(`### ${f.name}`);
      const d=firstSentence(stripHtml(f.system?.description?.value));
      if(d)L.push(d);
      L.push("");
    });
  }
  L.push("## Инвентарь","");
  if(weapons.length){
    L.push("### Оружие","| Название | Снаряжено | Урон | Тип | Свойства |","|---|---|---|---|---|");
    weapons.forEach(w=>{const eq=w.system?.equipped?"Да":"Нет",bd=w.system?.damage?.base,dmgStr=bd?`${bd.number??""}к${bd.denomination??""}${bd.bonus?"+"+bd.bonus:""}`:"-",dmgTypes=Object.keys(bd?.types||{}).join(",")||"—",props=Object.keys(w.system?.properties||{}).filter(p=>w.system.properties[p]).join(",")||"—";L.push(`| ${w.name} | ${eq} | ${dmgStr} | ${dmgTypes} | ${props} |`);});
    L.push("");
  }
  if(armors.length){L.push("### Броня","| Предмет | Снаряжено | КБ |","|----|----|----|");armors.forEach(a=>L.push(`| ${a.name} | ${a.system?.equipped?"Да":"Нет"} | ${a.system?.armor?.value??"—"} |`));L.push("");}
  if(consumables.length){L.push("### Расходуемые");consumables.forEach(c=>{const qty=c.system?.quantity??1,uses=c.system?.uses?.max?` (${c.system.uses.max-(c.system.uses.spent||0)}/${c.system.uses.max})`:"";L.push(`- **${c.name}** ×${qty}${uses}`);});L.push("");}
  if(loot.length||otherItems.length){L.push("### Прочее");[...loot,...otherItems].forEach(i=>L.push(`- ${i.name}`));L.push("");}
  L.push(`**Валюта:** ${curStr}  `,"");
  if(spells.length){
    L.push("## Заклинания",`**Характеристика:** ${ABILITY_RU[scAbility]||scAbility} | **СЛ:** ${spellDC} | **Бонус атаки:** +${spellAtk}  `,"");
    if(slotRows.length){L.push("### Ячейки","| Уровень | Всего | Исп. |","|---|---|---|");slotRows.forEach(r=>L.push(r));L.push("");}
    if(cantripSpells.length){L.push("### Заговоры");cantripSpells.forEach(sp=>{L.push(`#### ${sp.name}`);const d=stripHtml(sp.system?.description?.value);if(d)L.push(d);L.push("");});}
    const lvlN=["","1-го","2-го","3-го","4-го","5-го","6-го","7-го","8-го","9-го"];
    Object.keys(byLevel).sort((a,b)=>a-b).forEach(lvl=>{
      L.push(`### Заклинания ${lvlN[lvl]||lvl+"-го"} круга`);
      byLevel[lvl].forEach(sp=>{const school=SPELL_SCHOOL_RU[sp.system?.school]||"",conc=sp.system?.duration?.concentration?" [Конц.]":"";L.push(`#### ${sp.name}`,`*${school}${conc}*  `);const d=stripHtml(sp.system?.description?.value);if(d)L.push(d);L.push("");});
    });
  }
  L.push("## Личность");
  L.push(`**Мировоззрение:** ${det.alignment||"—"}  `,`**Возраст:** ${det.age||"—"}  `,"");
  if(det.trait){L.push("**Черты:**  ",stripHtml(det.trait),"");}
  if(det.ideal){L.push("**Идеалы:**  ",stripHtml(det.ideal),"");}
  if(det.bond){L.push("**Узы:**  ",stripHtml(det.bond),"");}
  if(det.flaw){L.push("**Изъяны:**  ",stripHtml(det.flaw),"");}
  if(det.biography?.value){L.push("## Биография",stripHtml(det.biography.value),"");}
  return L.join("\n");
}

// ── Логика инъекции кнопки ────────────────────────────────────────────────────

const BTN_CLASS = "md-export-btn";

/** Создаёт и возвращает кнопку экспорта для данного актора */
function createExportButton(actor) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.title = "MD Экспорт";
  btn.innerHTML = `<i class="fas fa-file-export"></i>`;
  btn.style.cssText = "flex:0 0 auto;padding:0 8px;background:none;border:none;cursor:pointer;font-size:14px;color:inherit;";
  btn.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    try {
      const md = generateMarkdown(actor);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${actor.name.replace(/[^\w\u0400-\u04ff\- ]/g,"_")}.md`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      ui.notifications.info(`✅ ${a.download}`);
    } catch(e) {
      console.error("fvtt-character-md-export | Ошибка:", e);
      ui.notifications.error("❌ Ошибка экспорта, см. F12");
    }
  });
  return btn;
}

/**
 * Инъекция кнопки для AppV2 (FoundryVTT v14).
 */
function injectButtonV2(app) {
  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

  const windowEl = app.element;
  if (!windowEl) return;
  if (windowEl.querySelector("." + BTN_CLASS)) return;

  const header = app.window?.header;
  if (!header) {
    console.warn("fvtt-character-md-export | app.window.header не найден", app);
    return;
  }

  const btn = createExportButton(actor);
  const closeBtn = app.window?.close ?? header.querySelector("[data-action='close']");
  closeBtn ? header.insertBefore(btn, closeBtn) : header.appendChild(btn);
  console.log("fvtt-character-md-export | [AppV2] кнопка добавлена для", actor.name);
}

/**
 * Инъекция кнопки для AppV1 (FoundryVTT v12–v13).
 */
function injectButtonV1(app, html) {
  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

  const el = html instanceof jQuery ? html[0] : html;
  const windowEl = el?.closest?.(".app") ?? el?.parentElement?.closest?.(".app") ?? el;
  if (!windowEl) return;
  if (windowEl.querySelector("." + BTN_CLASS)) return;

  const header = windowEl.querySelector(".window-header");
  if (!header) {
    console.warn("fvtt-character-md-export | [AppV1] .window-header не найден", windowEl);
    return;
  }

  const btn = createExportButton(actor);
  const closeBtn = header.querySelector("[data-action='close'], .close, button[aria-label='Close']");
  closeBtn ? header.insertBefore(btn, closeBtn) : header.appendChild(btn);
  console.log("fvtt-character-md-export | [AppV1] кнопка добавлена для", actor.name);
}

// ── Хуки ─────────────────────────────────────────────────────────────────────

Hooks.on("renderActorSheet", (app, html) => {
  injectButtonV1(app, html);
});

Hooks.on("renderApplicationV2", (app, html, _data) => {
  if (!app.actor) return;
  injectButtonV2(app);
});

Hooks.on("ready", () => {
  const observer = new MutationObserver(mutations => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const windowEl =
          node.classList.contains("application") ? node :
          node.classList.contains("app") ? node :
          node.querySelector?.(".application") ??
          node.querySelector?.(".app") ?? null;
        if (!windowEl) continue;
        let foundApp = null;
        try {
          // foundry.applications.instances — Map в v13+
          const instances = foundry.applications?.instances;
          const iter = (instances instanceof Map) ? instances.values() : (typeof instances === "function" ? instances() : null);
          if (iter) {
            for (const appInst of iter) {
              if (appInst.actor && appInst.element && windowEl.contains(appInst.element)) {
                foundApp = appInst; break;
              }
            }
          }
        } catch(_) {}
        if (foundApp) {
          if (foundApp.window) {
            injectButtonV2(foundApp);
          } else if (!windowEl.querySelector("." + BTN_CLASS) && foundApp.actor?.type === "character") {
            const header = windowEl.querySelector(".window-header");
            if (header) {
              const btn = createExportButton(foundApp.actor);
              const closeBtn = header.querySelector("[data-action='close'], .close");
              closeBtn ? header.insertBefore(btn, closeBtn) : header.appendChild(btn);
            }
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
  console.log("fvtt-character-md-export | MutationObserver (fallback) запущен");
});

console.log("fvtt-character-md-export | loaded ✓ (v12–v14 AppV1+AppV2 compat)");
