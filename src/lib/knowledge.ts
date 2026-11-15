/**
 * Knowledge base / Base de conhecimento.
 *
 * ⚠️ PROTOTYPE HEURISTICS – NOT A MEDICAL PROTOCOL. / HEURÍSTICA DE PROTÓTIPO – NÃO É PROTOCOLO MÉDICO.
 * Ranges come from published TERRESTRIAL clinical guidelines (AHA, NHLBI, ADA, CDC, AASM, PHQ-2)
 * and NASA publications. NASA flight-surgeon operational thresholds are NOT public. Baseline-deviation
 * thresholds (z-score, temperature delta) are design parameters of this prototype and flagged as such.
 */
import { l } from './i18n'
import type { L } from './i18n'

import { BANDS, BONE_LOSS_PER_MONTH_PCT, CAREER_LIMIT_MSV, ENV_NUMBERS, BASELINE_DAYS, TEMP_DELTA_ALERT, TEMP_DELTA_ATTENTION, Z_ALERT, Z_ATTENTION } from '../core/constants'
import type { Severity, IndicatorId, BodyRegionId, EnvironmentId } from '../core/constants'
export type { Severity, IndicatorId, BodyRegionId, EnvironmentId }
export const SEVERITY_LABEL: readonly L[] = [l('Nominal', 'Nominal'), l('Atenção', 'Caution'), l('Alerta', 'Warning'), l('Crítico', 'Critical')]
export const SEVERITY_COLOR = ['#34D399', '#FACC15', '#FB923C', '#FF6B6B'] as const

export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment'

export interface Source { label: string; url: string }

export const SOURCES = {
  aha_bp: { label: 'American Heart Association – Understanding Blood Pressure Readings', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings' },
  nhlbi_low_bp: { label: 'NHLBI – Low Blood Pressure (<90/60 mmHg)', url: 'https://www.nhlbi.nih.gov/health/low-blood-pressure' },
  aha_hr: { label: 'American Heart Association – Target Heart Rates (resting 60–100 bpm)', url: 'https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates' },
  norsk2015: { label: 'Norsk et al. 2015 – 24-h BP in ISS flight (J Physiol)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4324706/' },
  ada_dx: { label: 'American Diabetes Association – Diagnosis (fasting <100; ≥126 diabetes)', url: 'https://diabetes.org/about-diabetes/diagnosis' },
  ada_hypo: { label: 'American Diabetes Association – Hypoglycemia (<70; severe <54 mg/dL)', url: 'https://diabetes.org/living-with-diabetes/treatment-care/hypoglycemia-low-blood-glucose' },
  osd575: { label: 'NASA OSDR OSD-575 – Inspiration4 CMP (lab glucose range 65–99 mg/dL)', url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-575' },
  twins: { label: 'NASA Twins Study (Garrett-Bakelman et al. 2019, Science)', url: 'https://www.nasa.gov/twins-study/' },
  cdc_fever: { label: 'CDC – Fever: ≥38 °C (100.4 °F)', url: 'https://www.cdc.gov/quarantine/maritime/definitions-signs-symptoms-conditions-ill-travelers.html' },
  stahn2017: { label: 'Stahn et al. 2017 – "Space fever": core temperature rises ~1 °C on long missions (Sci Rep)', url: 'https://www.nature.com/articles/s41598-017-15560-w' },
  aasm: { label: 'AASM/SRS – Adults: ≥7 h of sleep per night (Watson et al. 2015)', url: 'https://jcsm.aasm.org/doi/10.5664/jcsm.4758' },
  barger2014: { label: 'Barger et al. 2014 – ISS sleep ~6.09 h/night (Lancet Neurol)', url: 'https://www.thelancet.com/journals/laneur/article/PIIS1474-4422(14)70122-X/abstract' },
  phq2: { label: 'Kroenke et al. 2003 – PHQ-2 (≥3 = positive screen)', url: 'https://pubmed.ncbi.nlm.nih.gov/14583691/' },
  std3001: { label: 'NASA-STD-3001 – Human Performance (600 mSv career limit)', url: 'https://www.nasa.gov/reference/4-0-human-performance/' },
  hazards: { label: 'NASA Human Research Program – 5 Hazards of Human Spaceflight', url: 'https://www.nasa.gov/hrp/hazards/' },
  hrr: { label: 'NASA Human Research Roadmap', url: 'https://humanresearchroadmap.nasa.gov/' },
  standardMeasures: { label: 'NASA – Spaceflight Standard Measures', url: 'https://www.nasa.gov/reference/standard-measures/' },
  bone: { label: 'NASA – Risk of Spaceflight-Induced Bone Changes (1–1.5% loss/month)', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' },
  gravity: { label: 'NASA HRP – Hazard: Gravity Fields', url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/' },
  distance: { label: 'NASA HRP – Hazard: Distance from Earth (up to 20 min one-way delay)', url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/' },
  donki: { label: 'NASA CCMC DONKI – Space Weather Database', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' },
  srag: { label: 'NASA JSC Space Radiation Analysis Group (SRAG) – crew radiation monitoring & shelter calls', url: 'https://srag.jsc.nasa.gov/' },
  radiationHazard: { label: 'NASA HRP – Hazard: Space Radiation', url: 'https://www.nasa.gov/hrp/hazard-space-radiation/' },
  pvtb: { label: 'Basner et al. 2011 – Brief PVT (PVT-B), 3 min, lapse ≥355 ms (Acta Astronautica)', url: 'https://pubmed.ncbi.nlm.nih.gov/22025811/' },
  cognition: { label: 'Basner et al. 2015 – Cognition test battery for spaceflight, incl. PVT (Aerosp Med Hum Perform)', url: 'https://pubmed.ncbi.nlm.nih.gov/26564759/' },
  ppg: { label: 'Coppetti et al. 2017 – Accuracy of smartphone camera apps for heart rate (Eur J Prev Cardiol)', url: 'https://pubmed.ncbi.nlm.nih.gov/28464700/' },
} satisfies Record<string, Source>

export const HAZARDS: Record<HazardId, { name: L; icon: string; summary: L }> = {
  radiation: { name: l('Radiação espacial', 'Space radiation'), icon: '☢️', summary: l('Raios cósmicos galácticos e eventos de partículas solares: risco de câncer, efeitos no SNC, cardiovasculares e imunes.', 'Galactic cosmic rays and solar particle events: cancer risk, CNS, cardiovascular and immune effects.') },
  isolation: { name: l('Isolamento e confinamento', 'Isolation and confinement'), icon: '🧠', summary: l('Alterações de humor, sono e desempenho cognitivo; conflitos de equipe.', 'Changes in mood, sleep and cognitive performance; crew conflict.') },
  distance: { name: l('Distância da Terra', 'Distance from Earth'), icon: '📡', summary: l('Atraso de comunicação e ausência de evacuação rápida: a tripulação precisa se autoavaliar e agir sozinha.', 'Communication delay and no quick evacuation: the crew must self-assess and act on its own.') },
  gravity: { name: l('Campos gravitacionais', 'Gravity fields'), icon: '🪐', summary: l('Microgravidade/gravidade parcial: perda óssea e muscular, deslocamento de fluidos, hipotensão ortostática na volta.', 'Microgravity/partial gravity: bone and muscle loss, fluid shift, orthostatic hypotension on return.') },
  environment: { name: l('Ambiente fechado hostil', 'Hostile closed environment'), icon: '🛰️', summary: l('CO₂, ruído, microbiota alterada, iluminação artificial: afeta sono, imunidade e cognição.', 'CO₂, noise, altered microbiome, artificial lighting: affects sleep, immunity and cognition.') },
}

export interface IndicatorInfo {
  id: IndicatorId
  name: L
  unit: string
  howToMeasure: L
  whyItMatters: L
  spaceEffect: L
  hazards: HazardId[]
  regions: BodyRegionId[]
  bands: { from: number; to: number; severity: Severity; label: L }[]
  actions: Record<Severity, L>
  sources: Source[]
}

export const INDICATORS: Record<IndicatorId, IndicatorInfo> = {
  bp: {
    id: 'bp', name: l('Pressão arterial', 'Blood pressure'), unit: 'mmHg',
    howToMeasure: l('Sentado/fixado, braço na altura do coração, 5 min em repouso, manguito automático. Registre sistólica/diastólica.', 'Seated/restrained, arm at heart level, 5 min rest, automatic cuff. Record systolic/diastolic.'),
    whyItMatters: l('Detecta hipertensão, hipotensão e intolerância ortostática que pode causar desmaio em EVA, pouso ou retorno.', 'Detects hypertension, hypotension and orthostatic intolerance that can cause fainting during EVA, landing or return.'),
    spaceEffect: l('Em órbita a PA média de 24 h cai (~8/9 mmHg em Norsk 2015) pelo deslocamento de fluidos. O maior risco é hipotensão ortostática ao voltar à gravidade.', 'In orbit, 24-h mean BP drops (~8/9 mmHg in Norsk 2015) due to fluid shift. The main risk is orthostatic hypotension on return to gravity.'),
    hazards: ['gravity', 'radiation', 'isolation'], regions: ['heart'],
    bands: [
      { ...BANDS.bp[0], label: l('Baixa (<90 NHLBI)', 'Low (<90 NHLBI)') },
      { ...BANDS.bp[1], label: l('Normal (<120 AHA)', 'Normal (<120 AHA)') },
      { ...BANDS.bp[2], label: l('Elevada / Estágio 1', 'Elevated / Stage 1') },
      { ...BANDS.bp[3], label: l('Estágio 2', 'Stage 2') },
      { ...BANDS.bp[4], label: l('Crise (>180)', 'Crisis (>180)') },
    ],
    actions: {
      0: l('Mantenha hidratação e exercício aeróbico/resistido conforme o plano.', 'Keep hydration and aerobic/resistive exercise per plan.'),
      1: l('Repita a medida em 15 min em repouso. Revise sal, cafeína e estresse. Se baixa: hidratação + sal conforme protocolo de carga de fluidos.', 'Repeat in 15 min at rest. Review salt, caffeine and stress. If low: fluids + salt per fluid-loading protocol.'),
      2: l('Repita 2× com 5 min de intervalo. Registre sintomas (cefaleia, visão turva, tontura). Notifique o médico da missão/CMO.', 'Repeat twice, 5 min apart. Log symptoms (headache, blurred vision, dizziness). Notify the Crew Medical Officer (CMO).'),
      3: l('Crise hipertensiva (>180/120) ou sintomas neurológicos/dor no peito: acione o CMO imediatamente e contate o solo.', 'Hypertensive crisis (>180/120) or neurological symptoms/chest pain: call the CMO immediately and contact the ground.'),
    },
    sources: [SOURCES.aha_bp, SOURCES.nhlbi_low_bp, SOURCES.norsk2015],
  },
  hr: {
    id: 'hr', name: l('Frequência cardíaca', 'Heart rate'), unit: 'bpm',
    howToMeasure: l('Em repouso, ao acordar, pelo oxímetro/camiseta biométrica ou 30 s de pulso radial ×2.', 'At rest on waking, via pulse oximeter/biometric shirt or 30 s radial pulse ×2.'),
    whyItMatters: l('Indica estado cardiovascular, febre, desidratação, estresse e arritmias.', 'Reflects cardiovascular status, fever, dehydration, stress and arrhythmias.'),
    spaceEffect: l('Em repouso fica perto do basal em voo; taquicardia aparece no retorno (descondicionamento) e com estresse/privação de sono.', 'Resting HR stays near baseline in flight; tachycardia appears on return (deconditioning) and with stress/sleep loss.'),
    hazards: ['gravity', 'isolation', 'environment'], regions: ['heart'],
    bands: [
      { ...BANDS.hr[0], label: l('<60 (bradicardia)', '<60 (bradycardia)') },
      { ...BANDS.hr[1], label: l('60–100 AHA', '60–100 AHA') },
      { ...BANDS.hr[2], label: l('>100 (taquicardia)', '>100 (tachycardia)') },
    ],
    actions: {
      0: l('Sem ação. Continue o check-in diário.', 'No action. Keep the daily check-in.'),
      1: l('Confirme em repouso após 5 min. Considere hidratação, cafeína, sono e temperatura.', 'Confirm after 5 min rest. Consider hydration, caffeine, sleep and temperature.'),
      2: l('Desvio grande da sua linha de base: verifique ritmo (ECG se disponível), sintomas e notifique o CMO.', 'Large deviation from your baseline: check rhythm (ECG if available), symptoms, and notify the CMO.'),
      3: l('Dor no peito, desmaio ou falta de ar com FC alterada: acione emergência médica de bordo e o solo.', 'Chest pain, fainting or shortness of breath with abnormal HR: start onboard medical emergency and call the ground.'),
    },
    sources: [SOURCES.aha_hr],
  },
  glucose: {
    id: 'glucose', name: l('Glicemia (jejum)', 'Blood glucose (fasting)'), unit: 'mg/dL',
    howToMeasure: l('Em jejum de 8 h, glicosímetro capilar (gota do dedo). Registre se não estiver em jejum.', 'After an 8-h fast, capillary glucometer (finger prick). Note if not fasting.'),
    whyItMatters: l('Hipoglicemia compromete cognição em tarefas críticas; tendência de alta sugere resistência à insulina.', 'Hypoglycemia impairs cognition in critical tasks; an upward trend suggests insulin resistance.'),
    spaceEffect: l('O NASA Twins Study associou voo longo a sinais de resistência à insulina; dieta e inatividade relativa também influenciam.', 'The NASA Twins Study linked long-duration flight to signs of insulin resistance; diet and relative inactivity also play a role.'),
    hazards: ['gravity', 'environment', 'distance'], regions: ['metabolism'],
    bands: [
      { ...BANDS.glucose[0], label: l('Hipo grave <54', 'Severe hypo <54') },
      { ...BANDS.glucose[1], label: l('Hipo <70', 'Hypo <70') },
      { ...BANDS.glucose[2], label: l('Normal <100 (ADA)', 'Normal <100 (ADA)') },
      { ...BANDS.glucose[3], label: l('Alterada 100–125', 'Impaired 100–125') },
      { ...BANDS.glucose[4], label: l('≥126', '≥126') },
    ],
    actions: {
      0: l('Mantenha o plano alimentar da missão.', 'Stick to the mission meal plan.'),
      1: l('Reavalie amanhã em jejum confirmado. Revise ingestão calórica/açúcares e exercício.', 'Re-test tomorrow with a confirmed fast. Review calories/sugars and exercise.'),
      2: l('Se <70: regra 15-15 (15 g de carboidrato rápido, remedir em 15 min). Se ≥126 em jejum repetido: notifique o CMO.', 'If <70: 15-15 rule (15 g fast carbs, re-test in 15 min). If ≥126 fasting on repeat: notify the CMO.'),
      3: l('<54 mg/dL: hipoglicemia grave. Carboidrato rápido já; se confuso/inconsciente, glucagon pelo kit médico e acione o solo.', '<54 mg/dL: severe hypoglycemia. Fast carbs now; if confused/unconscious, glucagon from the medical kit and call the ground.'),
    },
    sources: [SOURCES.ada_dx, SOURCES.ada_hypo, SOURCES.osd575, SOURCES.twins],
  },
  temp: {
    id: 'temp', name: l('Temperatura corporal', 'Body temperature'), unit: '°C',
    howToMeasure: l('Termômetro timpânico/oral no mesmo horário diário, longe de exercício.', 'Tympanic/oral thermometer at the same time daily, away from exercise.'),
    whyItMatters: l('Primeiro sinal de infecção, inflamação ou estresse térmico em ambiente fechado.', 'First sign of infection, inflammation or heat stress in a closed environment.'),
    spaceEffect: l('"Febre espacial": a temperatura central de repouso sobe ~1 °C em missões longas (Stahn 2017). Por isso o SISP avalia febre RELATIVA à sua linha de base de voo, não só o corte de 38 °C.', '"Space fever": resting core temperature rises ~1 °C on long missions (Stahn 2017). So SISP judges fever RELATIVE to your in-flight baseline, not only the 38 °C cutoff.'),
    hazards: ['environment', 'gravity', 'radiation'], regions: ['immune', 'brain'],
    bands: [
      { ...BANDS.temp[0], label: l('<36', '<36') },
      { ...BANDS.temp[1], label: l('Faixa usual', 'Usual range') },
      { ...BANDS.temp[2], label: l('Febre ≥38 (CDC)', 'Fever ≥38 (CDC)') },
    ],
    actions: {
      0: l('Sem ação.', 'No action.'),
      1: l('Acima da SUA base de voo: hidrate, reduza esforço, remedir em 4 h, observe sintomas (tosse, dor, urina).', 'Above YOUR in-flight baseline: hydrate, reduce exertion, re-measure in 4 h, watch for symptoms (cough, pain, urine).'),
      2: l('Febre: isole-se se possível, registre sintomas, antitérmico do kit conforme orientação, notifique o CMO.', 'Fever: isolate if possible, log symptoms, antipyretic from the kit as directed, notify the CMO.'),
      3: l('Febre alta persistente com sinais de gravidade (confusão, rigidez, falta de ar): contate o solo.', 'Persistent high fever with red flags (confusion, stiffness, shortness of breath): contact the ground.'),
    },
    sources: [SOURCES.cdc_fever, SOURCES.stahn2017],
  },
  sleep: {
    id: 'sleep', name: l('Sono', 'Sleep'), unit: 'h',
    howToMeasure: l('Horas dormidas na última noite (actígrafo/relógio ou autorrelato).', 'Hours slept last night (actigraph/watch or self-report).'),
    whyItMatters: l('Privação de sono aumenta erros operacionais, piora humor, imunidade e metabolismo.', 'Sleep loss increases operational errors and worsens mood, immunity and metabolism.'),
    spaceEffect: l('Na ISS os astronautas dormem em média ~6,09 h por noite e uso de hipnóticos é comum (Barger 2014). Luz artificial, ruído e ciclos de 90 min dia/noite atrapalham.', 'On the ISS astronauts average ~6.09 h of sleep per night and hypnotic use is common (Barger 2014). Artificial light, noise and 90-min day/night cycles interfere.'),
    hazards: ['isolation', 'environment', 'distance'], regions: ['brain'],
    bands: [
      { ...BANDS.sleep[0], label: l('<5 h', '<5 h') },
      { ...BANDS.sleep[1], label: l('5–7 h', '5–7 h') },
      { ...BANDS.sleep[2], label: l('≥7 h (AASM)', '≥7 h (AASM)') },
    ],
    actions: {
      0: l('Ótimo. Mantenha horário regular e higiene de sono.', 'Great. Keep a regular schedule and sleep hygiene.'),
      1: l('Abaixo da meta de 7 h: proteja a janela de sono, iluminação âmbar antes de dormir, evite cafeína nas 6 h prévias.', 'Below the 7-h target: protect your sleep window, amber light before bed, no caffeine in the prior 6 h.'),
      2: l('Privação importante: evite tarefas críticas/EVA sem dupla checagem e combine ajuste de escala com o comandante/CMO.', 'Significant sleep loss: avoid critical tasks/EVA without double-checks and agree a schedule change with the commander/CMO.'),
      3: l('Insônia severa por vários dias com sintomas de humor: avaliação comportamental com o solo.', 'Severe insomnia for several days with mood symptoms: behavioral health review with the ground.'),
    },
    sources: [SOURCES.aasm, SOURCES.barger2014],
  },
  mood: {
    id: 'mood', name: l('Humor (escala 1–5 + PHQ-2)', 'Mood (1–5 scale + PHQ-2)'), unit: 'pts',
    howToMeasure: l('Diário: como você se sente (1 = muito mal, 5 = muito bem). PHQ-2: 2 perguntas (pouco interesse/prazer; desânimo), cada 0–3.', 'Daily: how you feel (1 = very bad, 5 = very good). PHQ-2: 2 questions (little interest/pleasure; feeling down), each 0–3.'),
    whyItMatters: l('Isolamento e confinamento aumentam risco de depressão, ansiedade e conflitos, afetando segurança da missão.', 'Isolation and confinement raise the risk of depression, anxiety and conflict, affecting mission safety.'),
    spaceEffect: l('Isolamento, monotonia, distância da família e carga de trabalho são riscos comportamentais mapeados pelo HRP.', 'Isolation, monotony, distance from family and workload are behavioral risks mapped by the HRP.'),
    hazards: ['isolation', 'distance'], regions: ['brain'],
    bands: [
      { ...BANDS.mood[0], label: l('Humor baixo', 'Low mood') },
      { ...BANDS.mood[1], label: l('Usual', 'Usual') },
    ],
    actions: {
      0: l('Mantenha contato com família e lazer programado.', 'Keep in touch with family and scheduled leisure.'),
      1: l('Humor baixo: converse com um colega de confiança, garanta lazer, exercício e sono.', 'Low mood: talk to a trusted crewmate, protect leisure, exercise and sleep.'),
      2: l('PHQ-2 ≥3 (rastreio positivo): agende conferência privada de saúde comportamental com o solo.', 'PHQ-2 ≥3 (positive screen): schedule a private behavioral health conference with the ground.'),
      3: l('Pensamentos de se machucar: avise o CMO/comandante AGORA e contate o solo imediatamente. Você não está sozinho.', 'Thoughts of self-harm: tell the CMO/commander NOW and contact the ground immediately. You are not alone.'),
    },
    sources: [SOURCES.phq2, SOURCES.hazards],
  },
}

export const RADIATION = { careerLimitMSv: CAREER_LIMIT_MSV, source: SOURCES.std3001 }

export const BONE = {
  /** BMD loss per month without countermeasures (NASA) */
  lossPerMonthPct: BONE_LOSS_PER_MONTH_PCT,
  source: SOURCES.bone,
  note: l('Estimativa sem DEXA a bordo: projeta a perda pelo tempo em micro/baixa gravidade, reduzida pela adesão ao exercício resistido (heurística do protótipo).', 'Estimate without onboard DEXA: projects loss from time in micro/low gravity, reduced by resistive-exercise adherence (prototype heuristic).'),
}

export const BODY_REGIONS: Record<BodyRegionId, { name: L; short: L; fn: L; indicators: IndicatorId[]; hazards: HazardId[]; extra?: L }> = {
  brain: { name: l('Cérebro e comportamento', 'Brain and behavior'), short: l('Cérebro', 'Brain'), fn: l('Cognição, humor, sono e tomada de decisão – essenciais quando o solo está longe.', 'Cognition, mood, sleep and decision-making – essential when the ground is far away.'), indicators: ['sleep', 'mood', 'temp'], hazards: ['isolation', 'radiation', 'environment'] },
  heart: { name: l('Coração e circulação', 'Heart and circulation'), short: l('Coração', 'Heart'), fn: l('Bombeia sangue; em microgravidade os fluidos vão para a cabeça e o coração se descondiciona.', 'Pumps blood; in microgravity fluids shift headward and the heart deconditions.'), indicators: ['bp', 'hr'], hazards: ['gravity', 'radiation'] },
  lungs: { name: l('Pulmões e ambiente', 'Lungs and environment'), short: l('Pulmões', 'Lungs'), fn: l('Troca de gases; sensível a CO₂ e qualidade do ar da cabine.', 'Gas exchange; sensitive to CO₂ and cabin air quality.'), indicators: ['hr'], hazards: ['environment'], extra: l('Sintomas de CO₂ elevado: cefaleia, fadiga. Reporte ao controle ambiental.', 'High-CO₂ symptoms: headache, fatigue. Report to environmental control.') },
  metabolism: { name: l('Metabolismo e nutrição', 'Metabolism and nutrition'), short: l('Metabolismo', 'Metabolism'), fn: l('Energia, glicemia, massa corporal; dieta da missão e exercício afetam o controle glicêmico.', 'Energy, glucose, body mass; mission diet and exercise affect glycemic control.'), indicators: ['glucose'], hazards: ['gravity', 'environment', 'distance'] },
  musculoskeletal: { name: l('Ossos e músculos', 'Bones and muscles'), short: l('Ossos/músculos', 'Bones/muscles'), fn: l('Sustentação e locomoção; sem carga, perde-se ~1–1,5% de massa óssea por mês.', 'Support and locomotion; without load, ~1–1.5% of bone mass is lost per month.'), indicators: [], hazards: ['gravity'], extra: l('Perda óssea estimada pelo tempo de missão e adesão ao exercício.', 'Bone loss estimated from mission time and exercise adherence.') },
  immune: { name: l('Sistema imune', 'Immune system'), short: l('Imune', 'Immune'), fn: l('Defesa contra infecções; o voo altera a imunidade e reativa vírus latentes.', 'Defense against infection; spaceflight alters immunity and reactivates latent viruses.'), indicators: ['temp'], hazards: ['radiation', 'isolation', 'environment'] },
}

// ------------------------------------------------------------------ Mission environments

export interface EnvironmentInfo {
  id: EnvironmentId
  name: L
  emoji: string
  gravityG: number
  /** one-way communication delay in seconds (worst case for Mars) */
  delaySecOneWay: number
  delayLabel: L
  evacuation: L
  evacuationPossible: boolean
  radiationNote: L
  /** published dose rate (see public/data/radiation_reference.json) */
  doseMSvPerDay: number
}

export const ENVIRONMENTS: Record<EnvironmentId, EnvironmentInfo> = {
  iss: { id: 'iss', name: l('Estação Espacial (ISS)', 'Space Station (ISS)'), emoji: '🛰️', gravityG: 0, delaySecOneWay: 0.5, delayLabel: l('quase tempo real', 'near real time'), evacuation: l('Retorno à Terra em horas', 'Return to Earth within hours'), evacuationPossible: true, radiationNote: l('Protegida pela magnetosfera; ~0,2–0,5 mSv/dia.', 'Shielded by the magnetosphere; ~0.2–0.5 mSv/day.'), doseMSvPerDay: ENV_NUMBERS.iss.doseMSvPerDay },
  moonBase: { id: 'moonBase', name: l('Base lunar', 'Lunar base'), emoji: '🌕', gravityG: 0.166, delaySecOneWay: 1.3, delayLabel: l('~1,3 s (ida)', '~1.3 s (one-way)'), evacuation: l('Retorno em ~3 dias', 'Return in ~3 days'), evacuationPossible: true, radiationNote: l("Sem magnetosfera; superfície ~1,37 mSv/dia (Chang'e-4). Abrigo em eventos solares.", "No magnetosphere; surface ~1.37 mSv/day (Chang'e-4). Shelter during solar events."), doseMSvPerDay: ENV_NUMBERS.moonBase.doseMSvPerDay },
  marsTransit: { id: 'marsTransit', name: l('Trânsito para Marte', 'Mars transit'), emoji: '🚀', gravityG: 0, delaySecOneWay: 20 * 60, delayLabel: l('até ~20 min (ida)', 'up to ~20 min (one-way)'), evacuation: l('Sem retorno possível por meses', 'No return possible for months'), evacuationPossible: false, radiationNote: l('Espaço profundo: ~1,84 mSv/dia (MSL RAD no cruzeiro).', 'Deep space: ~1.84 mSv/day (MSL RAD during cruise).'), doseMSvPerDay: ENV_NUMBERS.marsTransit.doseMSvPerDay },
  marsBase: { id: 'marsBase', name: l('Base em Marte', 'Mars base'), emoji: '🔴', gravityG: 0.38, delaySecOneWay: 20 * 60, delayLabel: l('até ~20 min (ida)', 'up to ~20 min (one-way)'), evacuation: l('Sem retorno por ~18 meses', 'No return for ~18 months'), evacuationPossible: false, radiationNote: l('Superfície ~0,64 mSv/dia (Curiosity RAD).', 'Surface ~0.64 mSv/day (Curiosity RAD).'), doseMSvPerDay: ENV_NUMBERS.marsBase.doseMSvPerDay },
}

/** Prototype design parameters (NOT published clinical numbers). */
export const PROTOTYPE_HEURISTICS = {
  zAttention: Z_ATTENTION,
  zAlert: Z_ALERT,
  tempDeltaAttention: TEMP_DELTA_ATTENTION,
  tempDeltaAlert: TEMP_DELTA_ALERT,
  baselineDays: BASELINE_DAYS,
}
