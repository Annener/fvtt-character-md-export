/**
 * fvtt-character-md-export — main.js
 * Экспорт листа персонажа D&D 5e в Markdown для RAG-системы Mercer.
 */

// ── Утилиты ──────────────────────────────────────────────────────────────────

/** Модификатор по значению характеристики */
function mod(value) {
  const m = Math.floor((value - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

/** Полное значение + модификатор: "16 (+3)" */
function abilityStr(value) {
  return `${value} (${mod(value)})`;
}

/** Очистить HTML-теги из строки */
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

/** Бонус мастерства по уровню */
function proficiencyBonus(level) {
  return Math.ceil(level / 4) + 1;
}

/** Итоговый бонус навыка: profValue 0=нет,1=мастер,2=экспертиза */
function skillBonus(abilityValue, profValue, profBonus) {
  const base = Math.floor((abilityValue - 10) / 2);
  const add = profValue === 2 ? profBonus * 2 : profValue === 1 ? profBonus : 0;
  const total = base + add;
  return (total >= 0 ? `+${total}` : `${total}`) + (profValue > 0 ? " ✓" : "");
}

// ── Словари русских названий ──────────────────────────────────────────────────

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

// ── Основная функция генерации MD ────────────────────────────────────────────

function generateMarkdown(actor) {
  const s = actor.system;
  const items = actor.items.contents;

  // Уровень и класс
  const classItems = items.filter(i => i.type === "class");
  const subclassItems = items.filter(i => i.type === "subclass");
  const totalLevel = classItems.reduce((sum, c) => sum + (c.system.levels || 0), 0) || s.details?.level || 1;
  const classStr = classItems.map(c => {
    const sub = subclassItems.find(sc => sc.system?.classIdentifier === c.system?.identifier);
    return sub ? `${c.name} (${sub.name}) ${c.system.levels}` : `${c.name} ${c.system.levels}`;
  }).join(", ");

  const profBonus = proficiencyBonus(totalLevel);
  const ab = s.abilities;

  // Раса
  const raceItem = items.find(i => i.type === "race");
  const raceName = raceItem ? raceItem.name : (s.details?.race || "—");

  // Происхождение
  const bgItem = items.find(i => i.type === "background");
  const bgName = bgItem ? bgItem.name : "—";

  // Языки
  const langs = s.traits?.languages?.value || [];
  const langCustom = s.traits?.languages?.custom || "";
  const langStr = [...langs, ...(langCustom ? langCustom.split(";") : [])]
    .map(l => l.trim()).filter(Boolean).join(", ") || "—";

  // HP
  const hp = s.attributes?.hp;
  const hpStr = `${hp?.value ?? "?"}/${hp?.max ?? "?"}`
    + (hp?.temp ? ` (временные: ${hp.temp})` : "");

  // КБ
  const ac = s.attributes?.ac?.value ?? "?";

  // Скорость
  const mv = s.attributes?.movement;
  const speedStr = mv?.walk ? `${mv.walk} фут.` : "30 фут.";

  // Пассивное восприятие
  const prcVal = s.skills?.prc?.value ?? 0;
  const passivePerc = 10 + Math.floor((ab.wis.value - 10) / 2)
    + (prcVal === 2 ? profBonus * 2 : prcVal === 1 ? profBonus : 0);

  // Инициатива
  const initBonus = Math.floor((ab.dex.value - 10) / 2);
  const initStr = initBonus >= 0 ? `+${initBonus}` : `${initBonus}`;

  // Характеристики строка
  const abilityHeader = Object.keys(ABILITY_RU).map(k => ABILITY_RU[k]).join(" | ");
  const abilitySep    = Object.keys(ABILITY_RU).map(() => "-----").join(" | ");
  const abilityVals   = Object.keys(ABILITY_RU).map(k => abilityStr(ab[k]?.value ?? 10)).join(" | ");

  // Спасброски
  const saveHeader = Object.keys(ABILITY_RU).map(k => ABILITY_RU[k]).join(" | ");
  const saveVals = Object.keys(ABILITY_RU).map(k => {
    const profVal = ab[k]?.proficient ?? 0;
    return skillBonus(ab[k]?.value ?? 10, profVal, profBonus);
  }).join(" | ");

  // Навыки
  const skillLines = Object.entries(SKILL_RU).map(([key, ruName]) => {
    const sk = s.skills?.[key];
    const abilKey = SKILL_ABILITY[key];
    const abilVal = ab[abilKey]?.value ?? 10;
    const profVal = sk?.value ?? 0;
    return `${ruName} (${ABILITY_RU[abilKey]}): ${skillBonus(abilVal, profVal, profBonus)}`;
  });
  const profSkills  = skillLines.filter(l => l.includes("✓"));
  const otherSkills = skillLines.filter(l => !l.includes("✓"));

  // Инструменты
  const toolStr = Object.entries(s.tools || {}).map(([k, v]) => {
    const bonus = Math.floor((ab[v.ability || "dex"].value - 10) / 2)
      + (v.value > 0 ? profBonus * v.value : 0);
    return `${k}: ${bonus >= 0 ? "+" : ""}${bonus}`;
  }).join(", ") || "—";

  // Особенности расы
  const raceFeats = items.filter(i =>
    i.type === "feat" && (
      i.system?.type?.value === "race" ||
      (raceItem && i.flags?.dnd5e?.sourceItem?.identifier === raceItem.system?.identifier)
    )
  );

  // Особенности класса
  const classFeats = items.filter(i =>
    i.type === "feat" && (
      i.system?.type?.value === "class" ||
      classItems.some(c => i.system?.requirements?.toLowerCase().includes(c.name.toLowerCase()))
    ) && !raceFeats.includes(i)
  );

  // Прочие черты
  const otherFeats = items.filter(i =>
    i.type === "feat" && !raceFeats.includes(i) && !classFeats.includes(i)
  );

  // Инвентарь по типам
  const weapons     = items.filter(i => i.type === "weapon");
  const armors      = items.filter(i => i.type === "equipment" && i.system?.type?.value !== "trinket");
  const consumables = items.filter(i => i.type === "consumable");
  const containers  = items.filter(i => i.type === "container");
  const loot        = items.filter(i => i.type === "loot");
  const otherItems  = items.filter(i =>
    !["weapon","equipment","consumable","container","loot","class","subclass",
      "race","background","feat","spell"].includes(i.type)
  );

  // Валюта
  const cur = s.currency || {};
  const curStr = [
    cur.pp ? `${cur.pp} пз` : null,
    cur.gp ? `${cur.gp} зм` : null,
    cur.ep ? `${cur.ep} эм` : null,
    cur.sp ? `${cur.sp} сз` : null,
    cur.cp ? `${cur.cp} мз` : null,
  ].filter(Boolean).join(", ") || "—";

  // Заклинания
  const spells = items.filter(i => i.type === "spell");
  const spellSlots = s.spells || {};
  const spellcastingAbility = s.attributes?.spellcasting || "int";
  const spellcastingAb = ab[spellcastingAbility]?.value ?? 10;
  const spellDC  = 8 + profBonus + Math.floor((spellcastingAb - 10) / 2);
  const spellAtk = profBonus + Math.floor((spellcastingAb - 10) / 2);

  const innateSpells  = spells.filter(sp => sp.system?.preparation?.mode === "innate");
  const cantripSpells = spells.filter(sp => sp.system?.level === 0 && sp.system?.preparation?.mode !== "innate");
  const slottedSpells = spells.filter(sp => sp.system?.level > 0 && sp.system?.preparation?.mode !== "innate");

  const byLevel = {};
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

  // Личность
  const det = s.details || {};

  // ─── СБОРКА MARKDOWN ────────────────────────────────────────────────────────
  const lines = [];

  lines.push(`# ${actor.name}`);
  lines.push("");

  lines.push("## Общие сведения");
  lines.push(`**Пол:** ${det.gender || "—"}  `);
  lines.push(`**Раса:** ${raceName}  `);
  lines.push(`**Происхождение:** ${bgName}  `);
  lines.push(`**Уровень:** ${totalLevel}  `);
  lines.push(`**Класс:** ${classStr || "—"}  `);
  lines.push(`**Языки:** ${langStr}  `);
  lines.push("");

  lines.push("## Боевые характеристики");
  lines.push(`**Максимум HP:** ${hp?.max ?? "?"} | **Текущий HP:** ${hp?.value ?? "?"} | **Временный HP:** ${hp?.temp ?? 0}  `);
  lines.push(`**Класс брони:** ${ac}  `);
  lines.push(`**Скорость:** ${speedStr}  `);
  lines.push(`**Пассивная Внимательность:** ${passivePerc}  `);
  lines.push(`**Бонус мастерства:** +${profBonus}  `);
  lines.push(`**Инициатива:** ${initStr}  `);
  lines.push("");

  lines.push("## Характеристики");
  lines.push(`| ${abilityHeader} |`);
  lines.push(`| ${abilitySep} |`);
  lines.push(`| ${abilityVals} |`);
  lines.push("");

  lines.push("### Спасброски");
  lines.push(`| ${saveHeader} |`);
  lines.push(`| ${abilitySep} |`);
  lines.push(`| ${saveVals} |`);
  lines.push("*(✓ — владение)*");
  lines.push("");

  lines.push("### Навыки");
  if (profSkills.length) {
    lines.push("**Владение:**");
    profSkills.forEach(l => lines.push(`- ${l}`));
  }
  lines.push("**Остальные:**");
  otherSkills.forEach(l => lines.push(`- ${l}`));
  if (toolStr !== "—") lines.push(`**Инструменты:** ${toolStr}  `);
  lines.push("");

  if (raceFeats.length) {
    lines.push("## Особенности расы");
    raceFeats.forEach(f => {
      lines.push(`### ${f.name}`);
      const desc = stripHtml(f.system?.description?.value);
      if (desc) lines.push(desc);
      lines.push("");
    });
  }

  if (classFeats.length) {
    lines.push("## Особенности класса");
    classFeats.forEach(f => {
      lines.push(`### ${f.name}`);
      const desc = stripHtml(f.system?.description?.value);
      if (desc) lines.push(desc);
      if (f.system?.uses?.max) {
        lines.push(`*Использований: ${f.system.uses.max - (f.system.uses.spent || 0)}/${f.system.uses.max}*`);
      }
      lines.push("");
    });
  }

  if (otherFeats.length) {
    lines.push("## Прочие черты и способности");
    otherFeats.forEach(f => {
      lines.push(`### ${f.name}`);
      const desc = stripHtml(f.system?.description?.value);
      if (desc) lines.push(desc);
      lines.push("");
    });
  }

  lines.push("## Инвентарь");
  lines.push("");

  if (weapons.length) {
    lines.push("### Оружие");
    lines.push("| Название | Снаряжено | Урон | Тип урона | Свойства |");
    lines.push("|----------|-----------|------|-----------|----------|");
    weapons.forEach(w => {
      const eq = w.system?.equipped ? "Да" : "Нет";
      const baseDmg = w.system?.damage?.base;
      const dmgStr = baseDmg
        ? `${baseDmg.number ?? ""}к${baseDmg.denomination ?? ""}${baseDmg.bonus ? `+${baseDmg.bonus}` : ""}`
        : "—";
      const dmgTypes = Object.keys(baseDmg?.types || {}).join(", ") || "—";
      const props = Object.keys(w.system?.properties || {})
        .filter(p => w.system.properties[p] === true || w.system.properties[p]).join(", ") || "—";
      lines.push(`| ${w.name} | ${eq} | ${dmgStr} | ${dmgTypes} | ${props} |`);
    });
    lines.push("");
  }

  if (armors.length) {
    lines.push("### Броня и защита");
    lines.push("| Предмет | Снаряжено | КБ | Свойства |");
    lines.push("|---------|-----------|----|-----------|");
    armors.forEach(a => {
      const eq = a.system?.equipped ? "Да" : "Нет";
      const armorVal = a.system?.armor?.value ?? "—";
      const props = Object.keys(a.system?.properties || {})
        .filter(p => a.system.properties[p]).join(", ") || "—";
      lines.push(`| ${a.name} | ${eq} | ${armorVal} | ${props} |`);
    });
    lines.push("");
  }

  if (consumables.length) {
    lines.push("### Расходуемые предметы");
    consumables.forEach(c => {
      const qty = c.system?.quantity ?? 1;
      const uses = c.system?.uses?.max
        ? ` (${c.system.uses.max - (c.system.uses.spent || 0)}/${c.system.uses.max} зарядов)`
        : "";
      const desc = stripHtml(c.system?.description?.value);
      lines.push(`- **${c.name}** ×${qty}${uses}` + (desc ? ` — ${desc.split("\n")[0]}` : ""));
    });
    lines.push("");
  }

  if (containers.length) {
    lines.push("### Контейнеры");
    containers.forEach(c => lines.push(`- **${c.name}**`));
    lines.push("");
  }

  if (loot.length || otherItems.length) {
    lines.push("### Прочее снаряжение");
    [...loot, ...otherItems].forEach(i => {
      const qty = i.system?.quantity ?? 1;
      lines.push(`- ${i.name}${qty > 1 ? ` ×${qty}` : ""}`);
    });
    lines.push("");
  }

  lines.push(`**Валюта:** ${curStr}  `);
  lines.push("");

  if (spells.length) {
    lines.push("## Заклинания");
    lines.push(`**Характеристика заклинателя:** ${ABILITY_RU[spellcastingAbility] || spellcastingAbility} | **СЛ спасброска:** ${spellDC} | **Бонус атаки:** +${spellAtk}  `);
    lines.push("");

    if (slotRows.length) {
      lines.push("### Ячейки заклинаний");
      lines.push("| Уровень | Всего | Использовано |");
      lines.push("|---------|-------|--------------|");
      slotRows.forEach(r => lines.push(r));
      lines.push("");
    }

    if (innateSpells.length) {
      lines.push("### Врождённые заклинания");
      innateSpells.forEach(sp => {
        const usesMax  = sp.system?.uses?.max;
        const usesLeft = usesMax != null ? sp.system.uses.max - (sp.system.uses.spent || 0) : null;
        const usesStr  = usesLeft !== null ? ` (${usesLeft}/${usesMax})` : "";
        const recovery = sp.system?.uses?.recovery?.[0]?.period;
        const recStr   = recovery ? ` [восст.: ${recovery}]` : "";
        lines.push(`#### ${sp.name}${usesStr}${recStr}`);
        const desc = stripHtml(sp.system?.description?.value);
        if (desc) lines.push(desc);
        lines.push("");
      });
    }

    if (cantripSpells.length) {
      lines.push("### Заговоры (фокусы)");
      cantripSpells.forEach(sp => {
        lines.push(`#### ${sp.name}`);
        const desc = stripHtml(sp.system?.description?.value);
        if (desc) lines.push(desc);
        lines.push("");
      });
    }

    const levelNames = ["","1-го","2-го","3-го","4-го","5-го","6-го","7-го","8-го","9-го"];
    Object.keys(byLevel).sort((a,b) => a-b).forEach(lvl => {
      lines.push(`### Заклинания ${levelNames[lvl] || lvl+"-го"} круга`);
      byLevel[lvl].forEach(sp => {
        const school = SPELL_SCHOOL_RU[sp.system?.school] || sp.system?.school || "";
        const conc   = sp.system?.duration?.concentration ? " [Концентрация]" : "";
        lines.push(`#### ${sp.name}`);
        lines.push(`*${school}${conc}*  `);
        const desc = stripHtml(sp.system?.description?.value);
        if (desc) lines.push(desc);
        lines.push("");
      });
    });
  }

  lines.push("## Личность");
  lines.push(`**Мировоззрение:** ${det.alignment || "—"}  `);
  lines.push(`**Вера:** ${det.faith || "—"}  `);
  lines.push(`**Возраст:** ${det.age || "—"}  `);
  lines.push("");
  lines.push("**Внешность:**  ");
  lines.push(`Глаза: ${det.eyes || "—"} | Волосы: ${det.hair || "—"} | Кожа: ${det.skin || "—"}  `);
  lines.push(`Рост: ${det.height || "—"} | Вес: ${det.weight || "—"}  `);
  if (det.appearance) { lines.push(""); lines.push(stripHtml(det.appearance)); }
  lines.push("");

  if (det.trait)  { lines.push("**Черты характера:**  "); lines.push(stripHtml(det.trait));  lines.push(""); }
  if (det.ideal)  { lines.push("**Идеалы:**  ");          lines.push(stripHtml(det.ideal));  lines.push(""); }
  if (det.bond)   { lines.push("**Узы:**  ");             lines.push(stripHtml(det.bond));   lines.push(""); }
  if (det.flaw)   { lines.push("**Изъяны:**  ");          lines.push(stripHtml(det.flaw));   lines.push(""); }

  if (det.biography?.value) {
    lines.push("## Биография");
    lines.push(stripHtml(det.biography.value));
    lines.push("");
  }

  return lines.join("\n");
}

// ── Кнопка в шапке листа ────────────────────────────────────────────────────

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (sheet.actor.type !== "character") return;

  buttons.unshift({
    label: "MD Экспорт",
    class: "mercer-export-md",
    icon: "fas fa-file-export",
    onclick: () => {
      try {
        const md = generateMarkdown(sheet.actor);
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        const safeName = sheet.actor.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ\-_ ]/g, "_");
        a.href     = url;
        a.download = `${safeName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ui.notifications.info(`✅ Экспортировано: ${safeName}.md`);
      } catch (e) {
        console.error("fvtt-character-md-export | Ошибка экспорта:", e);
        ui.notifications.error("❌ Ошибка экспорта. Подробности в консоли (F12).");
      }
    }
  });
});

console.log("fvtt-character-md-export | loaded ✓");
