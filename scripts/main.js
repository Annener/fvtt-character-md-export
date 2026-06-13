/**
 * fvtt-character-md-export — main.js
 * Экспорт листа персонажа D&D 5e в Markdown для RAG-системы Mercer.
 * Совместимо: FoundryVTT v12–v14
 */

// ── Утилиты ──────────────────────────────────────────────────────────────────

function mod(value) {
  const m = Math.floor((value - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function abilityStr(value) {
  return `${value} (${mod(value)})`;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function proficiencyBonus(level) {
  return Math.ceil(level / 4) + 1;
}

function skillBonus(abilityValue, profValue, profBonus) {
  const base = Math.floor((abilityValue - 10) / 2);
  const add = profValue === 2 ? profBonus * 2 : profValue === 1 ? profBonus : 0;
  const total = base + add;
  return (total >= 0 ? `+${total}` : `${total}`) + (profValue > 0 ? " ✓" : "");
}

// ── Словари ──────────────────────────────────────────────────────────────────────────

const ABILITY_RU = { str: "СИЛ", dex: "ЛВК", con: "ВЫН", int: "ИНТ", wis: "МДР", cha: "ХАР" };

const SKILL_RU = {
  acr: "Акробатика",     ani: "Уход за животными", arc: "Магия",
  ath: "Атлетика",       dec: "Обман",              his: "История",
  ins: "Проницательность", itm: "Запугивание",      inv: "Анализ",
  med: "Медицина",       nat: "Природа",            prc: "Восприятие",
  prf: "Выступление",    per: "Убеждение",          rel: "Религия",
  slt: "Ловкость рук",   ste: "Скрытность",         sur: "Выживание"
};

const SKILL_ABILITY = {
  acr:"dex", ani:"wis", arc:"int", ath:"str", dec:"cha", his:"int",
  ins:"wis", itm:"cha", inv:"int", med:"wis", nat:"int", prc:"wis",
  prf:"cha", per:"cha", rel:"int", slt:"dex", ste:"dex", sur:"wis"
};

const SPELL_SCHOOL_RU = {
  abj:"Ограждение", con:"Вызов", div:"Прорицание", enc:"Очарование",
  evo:"Воплощение", ill:"Иллюзия", nec:"Некромантия", trs:"Преобразование"
};

// ── Генерация Markdown ───────────────────────────────────────────────────────────

function generateMarkdown(actor) {
  const s = actor.system;
  const items = actor.items.contents;

  const classItems    = items.filter(i => i.type === "class");
  const subclassItems = items.filter(i => i.type === "subclass");
  const totalLevel    = classItems.reduce((sum, c) => sum + (c.system.levels || 0), 0) || s.details?.level || 1;
  const classStr      = classItems.map(c => {
    const sub = subclassItems.find(sc => sc.system?.classIdentifier === c.system?.identifier);
    return sub ? `${c.name} (${sub.name}) ${c.system.levels}` : `${c.name} ${c.system.levels}`;
  }).join(", ");

  const profBonus = proficiencyBonus(totalLevel);
  const ab = s.abilities;

  const raceItem = items.find(i => i.type === "race");
  const raceName = raceItem ? raceItem.name : (s.details?.race || "—");
  const bgItem   = items.find(i => i.type === "background");
  const bgName   = bgItem ? bgItem.name : "—";

  const langs    = s.traits?.languages?.value || [];
  const langCustom = s.traits?.languages?.custom || "";
  const langStr  = [...langs, ...(langCustom ? langCustom.split(";") : [])]
    .map(l => l.trim()).filter(Boolean).join(", ") || "—";

  const hp        = s.attributes?.hp;
  const ac        = s.attributes?.ac?.value ?? "?";
  const mv        = s.attributes?.movement;
  const speedStr  = mv?.walk ? `${mv.walk} фут.` : "30 фут.";
  const prcVal    = s.skills?.prc?.value ?? 0;
  const passivePerc = 10 + Math.floor((ab.wis.value - 10) / 2)
    + (prcVal === 2 ? profBonus * 2 : prcVal === 1 ? profBonus : 0);
  const initBonus = Math.floor((ab.dex.value - 10) / 2);
  const initStr   = initBonus >= 0 ? `+${initBonus}` : `${initBonus}`;

  const abilityHeader = Object.keys(ABILITY_RU).map(k => ABILITY_RU[k]).join(" | ");
  const abilitySep    = Object.keys(ABILITY_RU).map(() => "-----").join(" | ");
  const abilityVals   = Object.keys(ABILITY_RU).map(k => abilityStr(ab[k]?.value ?? 10)).join(" | ");
  const saveVals      = Object.keys(ABILITY_RU).map(k => {
    const profVal = ab[k]?.proficient ?? 0;
    return skillBonus(ab[k]?.value ?? 10, profVal, profBonus);
  }).join(" | ");

  const skillLines  = Object.entries(SKILL_RU).map(([key, ruName]) => {
    const sk      = s.skills?.[key];
    const abilKey = SKILL_ABILITY[key];
    const abilVal = ab[abilKey]?.value ?? 10;
    const profVal = sk?.value ?? 0;
    return `${ruName} (${ABILITY_RU[abilKey]}): ${skillBonus(abilVal, profVal, profBonus)}`;
  });
  const profSkills  = skillLines.filter(l => l.includes("✓"));
  const otherSkills = skillLines.filter(l => !l.includes("✓"));

  const toolStr = Object.entries(s.tools || {}).map(([k, v]) => {
    const bonus = Math.floor((ab[v.ability || "dex"].value - 10) / 2)
      + (v.value > 0 ? profBonus * v.value : 0);
    return `${k}: ${bonus >= 0 ? "+" : ""}${bonus}`;
  }).join(", ") || "—";

  const raceFeats  = items.filter(i =>
    i.type === "feat" && (
      i.system?.type?.value === "race" ||
      (raceItem && i.flags?.dnd5e?.sourceItem?.identifier === raceItem.system?.identifier)
    )
  );
  const classFeats = items.filter(i =>
    i.type === "feat" && (
      i.system?.type?.value === "class" ||
      classItems.some(c => i.system?.requirements?.toLowerCase().includes(c.name.toLowerCase()))
    ) && !raceFeats.includes(i)
  );
  const otherFeats = items.filter(i =>
    i.type === "feat" && !raceFeats.includes(i) && !classFeats.includes(i)
  );

  const weapons     = items.filter(i => i.type === "weapon");
  const armors      = items.filter(i => i.type === "equipment");
  const consumables = items.filter(i => i.type === "consumable");
  const containers  = items.filter(i => i.type === "container");
  const loot        = items.filter(i => i.type === "loot");
  const otherItems  = items.filter(i =>
    !["weapon","equipment","consumable","container","loot","class","subclass",
      "race","background","feat","spell"].includes(i.type)
  );

  const cur    = s.currency || {};
  const curStr = [cur.pp&&`${cur.pp} пз`, cur.gp&&`${cur.gp} зм`, cur.ep&&`${cur.ep} эм`,
                  cur.sp&&`${cur.sp} сз`, cur.cp&&`${cur.cp} мз`].filter(Boolean).join(", ") || "—";

  const spells              = items.filter(i => i.type === "spell");
  const spellSlots          = s.spells || {};
  const spellcastingAbility = s.attributes?.spellcasting || "int";
  const spellcastingAb      = ab[spellcastingAbility]?.value ?? 10;
  const spellDC             = 8 + profBonus + Math.floor((spellcastingAb - 10) / 2);
  const spellAtk            = profBonus + Math.floor((spellcastingAb - 10) / 2);
  const innateSpells        = spells.filter(sp => sp.system?.preparation?.mode === "innate");
  const cantripSpells       = spells.filter(sp => sp.system?.level === 0 && sp.system?.preparation?.mode !== "innate");
  const slottedSpells       = spells.filter(sp => sp.system?.level > 0 && sp.system?.preparation?.mode !== "innate");
  const byLevel             = {};
  slottedSpells.forEach(sp => {
    const lvl = sp.system.level;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(sp);
  });
  const slotRows = [];
  for (let i = 1; i <= 9; i++) {
    const slot = spellSlots[`spell${i}`];
    if (slot?.max > 0) slotRows.push(`| ${i}-й | ${slot.max} | ${slot.value ?? 0} |`);
  }

  const det = s.details || {};
  const lines = [];

  lines.push(`# ${actor.name}`, "");
  lines.push("## Общие сведения");
  lines.push(`**Пол:** ${det.gender||"—"}  `, `**Раса:** ${raceName}  `,
             `**Происхождение:** ${bgName}  `, `**Уровень:** ${totalLevel}  `,
             `**Класс:** ${classStr||"—"}  `, `**Языки:** ${langStr}  `, "");

  lines.push("## Боевые характеристики");
  lines.push(`**HP:** ${hp?.value??"?"}/${hp?.max??"?"} | **Темп HP:** ${hp?.temp??0}  `,
             `**КБ:** ${ac}  `, `**Скорость:** ${speedStr}  `,
             `**Пасс. внимательность:** ${passivePerc}  `,
             `**Бонус мастерства:** +${profBonus}  `, `**Инициатива:** ${initStr}  `, "");

  lines.push("## Характеристики",
             `| ${abilityHeader} |`, `| ${abilitySep} |`, `| ${abilityVals} |`, "");
  lines.push("### Спасброски",
             `| ${abilityHeader} |`, `| ${abilitySep} |`, `| ${saveVals} |`,
             "*(✓ — владение)*", "");

  lines.push("### Навыки");
  if (profSkills.length) { lines.push("**Владение:**"); profSkills.forEach(l => lines.push(`- ${l}`)); }
  lines.push("**Остальные:**");
  otherSkills.forEach(l => lines.push(`- ${l}`));
  if (toolStr !== "—") lines.push(`**Инструменты:** ${toolStr}  `);
  lines.push("");

  if (raceFeats.length) {
    lines.push("## Особенности расы");
    raceFeats.forEach(f => { lines.push(`### ${f.name}`); const d=stripHtml(f.system?.description?.value); if(d) lines.push(d); lines.push(""); });
  }
  if (classFeats.length) {
    lines.push("## Особенности класса");
    classFeats.forEach(f => {
      lines.push(`### ${f.name}`);
      const d = stripHtml(f.system?.description?.value); if(d) lines.push(d);
      if (f.system?.uses?.max) lines.push(`*Использований: ${f.system.uses.max-(f.system.uses.spent||0)}/${f.system.uses.max}*`);
      lines.push("");
    });
  }
  if (otherFeats.length) {
    lines.push("## Прочие черты");
    otherFeats.forEach(f => { lines.push(`### ${f.name}`); const d=stripHtml(f.system?.description?.value); if(d) lines.push(d); lines.push(""); });
  }

  lines.push("## Инвентарь", "");
  if (weapons.length) {
    lines.push("### Оружие", "| Название | Снаряжено | Урон | Тип урона | Свойства |",
                "|----------|-----------|------|-----------|----------|" );
    weapons.forEach(w => {
      const eq = w.system?.equipped ? "Да" : "Нет";
      const bd = w.system?.damage?.base;
      const dmgStr = bd ? `${bd.number??""}к${bd.denomination??""}${bd.bonus?"+"+bd.bonus:""}` : "—";
      const dmgTypes = Object.keys(bd?.types||{}).join(", ")||"—";
      const props = Object.keys(w.system?.properties||{}).filter(p=>w.system.properties[p]===true||w.system.properties[p]).join(", ")||"—";
      lines.push(`| ${w.name} | ${eq} | ${dmgStr} | ${dmgTypes} | ${props} |`);
    });
    lines.push("");
  }
  if (armors.length) {
    lines.push("### Броня", "| Предмет | Снаряжено | КБ |", "|---------|-----------|----|" );
    armors.forEach(a => lines.push(`| ${a.name} | ${a.system?.equipped?"Да":"Нет"} | ${a.system?.armor?.value??"—"} |`));
    lines.push("");
  }
  if (consumables.length) {
    lines.push("### Расходуемые");
    consumables.forEach(c => {
      const qty = c.system?.quantity??1;
      const uses = c.system?.uses?.max ? ` (${c.system.uses.max-(c.system.uses.spent||0)}/${c.system.uses.max})` : "";
      lines.push(`- **${c.name}** ×${qty}${uses}`);
    });
    lines.push("");
  }
  if (loot.length||otherItems.length) {
    lines.push("### Прочее");
    [...loot,...otherItems].forEach(i => lines.push(`- ${i.name}${(i.system?.quantity??1)>1?` ×${i.system.quantity}`:""}`) );
    lines.push("");
  }
  lines.push(`**Валюта:** ${curStr}  `, "");

  if (spells.length) {
    lines.push("## Заклинания");
    lines.push(`**Характеристика:** ${ABILITY_RU[spellcastingAbility]||spellcastingAbility} | **СЛ:** ${spellDC} | **Бонус атаки:** +${spellAtk}  `, "");
    if (slotRows.length) {
      lines.push("### Ячейки", "| Уровень | Всего | Использовано |", "|---------|-------|--------------|");
      slotRows.forEach(r => lines.push(r)); lines.push("");
    }
    if (innateSpells.length) {
      lines.push("### Врождённые");
      innateSpells.forEach(sp => {
        const uMax = sp.system?.uses?.max;
        const uLeft = uMax!=null ? sp.system.uses.max-(sp.system.uses.spent||0) : null;
        const rec = sp.system?.uses?.recovery?.[0]?.period;
        lines.push(`#### ${sp.name}${uLeft!==null?` (${uLeft}/${uMax})`:""} ${rec?`[восст.:${rec}]`:""}`);
        const d = stripHtml(sp.system?.description?.value); if(d) lines.push(d); lines.push("");
      });
    }
    if (cantripSpells.length) {
      lines.push("### Заговоры");
      cantripSpells.forEach(sp => { lines.push(`#### ${sp.name}`); const d=stripHtml(sp.system?.description?.value); if(d) lines.push(d); lines.push(""); });
    }
    const lvlNames = ["","1-го","2-го","3-го","4-го","5-го","6-го","7-го","8-го","9-го"];
    Object.keys(byLevel).sort((a,b)=>a-b).forEach(lvl => {
      lines.push(`### Заклинания ${lvlNames[lvl]||lvl+"-го"} круга`);
      byLevel[lvl].forEach(sp => {
        const school = SPELL_SCHOOL_RU[sp.system?.school]||sp.system?.school||"";
        const conc   = sp.system?.duration?.concentration ? " [Концентрация]" : "";
        lines.push(`#### ${sp.name}`, `*${school}${conc}*  `);
        const d=stripHtml(sp.system?.description?.value); if(d) lines.push(d); lines.push("");
      });
    });
  }

  lines.push("## Личность");
  lines.push(`**Мировоззрение:** ${det.alignment||"—"}  `,
             `**Возраст:** ${det.age||"—"}  `, "");
  if (det.trait)  { lines.push("**Черты:**  ",  stripHtml(det.trait),  ""); }
  if (det.ideal)  { lines.push("**Идеалы:**  ",  stripHtml(det.ideal),  ""); }
  if (det.bond)   { lines.push("**Узы:**  ",     stripHtml(det.bond),   ""); }
  if (det.flaw)   { lines.push("**Изъяны:**  ",  stripHtml(det.flaw),   ""); }
  if (det.biography?.value) { lines.push("## Биография", stripHtml(det.biography.value), ""); }

  return lines.join("\n");
}

// ── Добавление кнопки через renderActorSheet (v12–v14) ──────────────────────────────

Hooks.on("renderActorSheet", (app, html, data) => {
  if (app.actor.type !== "character") return;

  // Проверяем не добавляли кнопку уже
  const existing = html[0]?.querySelector(".mercer-export-btn") ??
                   html.querySelector?.(".mercer-export-btn");
  if (existing) return;

  // Находим шапку: сначала ищем в предке windowHeader,
  // если не нашли — берём closest из html
  const root     = html[0] ?? html;
  const appEl    = root.closest?.(".app") ?? root.parentElement?.closest?.(".app") ?? root;
  const header   = appEl?.querySelector(".window-header") ??
                   appEl?.querySelector(".window-title")?.parentElement;

  if (!header) {
    console.warn("fvtt-character-md-export | Не нашла шапку окна, кнопка не добавлена");
    return;
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mercer-export-btn";
  btn.title = "MD Экспорт";
  btn.innerHTML = `<i class="fas fa-file-export"></i> MD`;
  btn.style.cssText = "margin-inline:4px;padding:2px 8px;font-size:12px;cursor:pointer;";

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    try {
      const md   = generateMarkdown(app.actor);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${app.actor.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\-_ ]/g, "_")}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ui.notifications.info(`✅ ${a.download} экспортирован`);
    } catch(e) {
      console.error("fvtt-character-md-export | Ошибка:", e);
      ui.notifications.error("❌ Ошибка экспорта (F12)");
    }
  });

  // Вставляем перед кнопкой закрытия
  const closeBtn = header.querySelector(".header-button.close") ??
                   header.querySelector("[data-action=close]") ??
                   header.querySelector(".close");
  if (closeBtn) {
    header.insertBefore(btn, closeBtn);
  } else {
    header.appendChild(btn);
  }
});

console.log("fvtt-character-md-export | loaded ✓");
