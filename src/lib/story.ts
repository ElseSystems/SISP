/**
 * Storytelling layer / Camada narrativa: the 5 NASA HRP hazards mapped onto the body,
 * and the scripted one-click demo used in the pitch.
 */
import { l } from './i18n'
import type { L } from './i18n'
import { SOURCES } from './knowledge'
import type { BodyRegionId, EnvironmentId, HazardId, Source } from './knowledge'
import type { Tab } from './store'

export interface HazardStory { regions: BodyRegionId[]; impact: L; sispWatches: L; countermeasure: L; source: Source }

export const HAZARD_ORDER: HazardId[] = ['radiation', 'isolation', 'distance', 'gravity', 'environment']

export const HAZARD_STORY: Record<HazardId, HazardStory> = {
  radiation: {
    regions: ['brain', 'heart', 'immune'],
    impact: l('Raios cósmicos e tempestades solares danificam o DNA: risco de câncer, efeitos no SNC, no coração e na imunidade.', 'Cosmic rays and solar storms damage DNA: cancer risk, CNS, heart and immune effects.'),
    sispWatches: l('Dose acumulada vs. limite de carreira de 600 mSv (NASA-STD-3001) + alertas solares reais do DONKI.', 'Cumulative dose vs. the 600 mSv career limit (NASA-STD-3001) + real DONKI solar alerts.'),
    countermeasure: l('Abrigo blindado durante eventos solares; planejar EVAs fora de janelas de risco.', 'Shielded shelter during solar events; plan EVAs outside risk windows.'),
    source: SOURCES.std3001,
  },
  isolation: {
    regions: ['brain'],
    impact: l('Meses confinado alteram humor, sono e cognição — e o desempenho da equipe.', 'Months in confinement change mood, sleep and cognition — and crew performance.'),
    sispWatches: l('Horas de sono, humor diário 1–5 e triagem PHQ-2 semanal, comparados à base pessoal.', 'Sleep hours, daily 1–5 mood and weekly PHQ-2 screen, compared to the personal baseline.'),
    countermeasure: l('Higiene do sono, luz programada, contato com família e apoio psicológico do solo.', 'Sleep hygiene, scheduled lighting, family contact and ground psychological support.'),
    source: SOURCES.barger2014,
  },
  distance: {
    regions: ['brain', 'heart', 'lungs', 'metabolism', 'musculoskeletal', 'immune'],
    impact: l('Até 20 min de atraso (ida) e nenhuma evacuação rápida: o médico está longe demais para uma emergência.', 'Up to 20 min one-way delay and no quick evacuation: the doctor is too far away for an emergency.'),
    sispWatches: l('Todo o corpo: o SISP ajusta o protocolo de escalonamento ao atraso de comunicação do ambiente.', 'The whole body: SISP adapts the escalation protocol to the environment’s communication delay.'),
    countermeasure: l('Autonomia: autoavaliação guiada, manuais de emergência offline e relatório compacto para o solo.', 'Autonomy: guided self-assessment, offline emergency manuals and a compact report for the ground.'),
    source: SOURCES.distance,
  },
  gravity: {
    regions: ['heart', 'musculoskeletal', 'metabolism'],
    impact: l('Sem carga, perde-se 1–1,5% de osso por mês; fluidos sobem para a cabeça e o coração se descondiciona.', 'Without load, 1–1.5% of bone is lost per month; fluids shift headward and the heart deconditions.'),
    sispWatches: l('Pressão, frequência cardíaca e perda óssea estimada pelos dias de missão e adesão ao exercício.', 'Blood pressure, heart rate and bone loss estimated from mission days and exercise adherence.'),
    countermeasure: l('~2 h/dia de exercício resistido (ARED) + aeróbico; cálcio e vitamina D.', '~2 h/day resistive (ARED) + aerobic exercise; calcium and vitamin D.'),
    source: SOURCES.bone,
  },
  environment: {
    regions: ['lungs', 'immune', 'brain'],
    impact: l('CO₂, ruído, luz artificial e microbiota alterada afetam sono, imunidade e cognição.', 'CO₂, noise, artificial light and altered microbiome affect sleep, immunity and cognition.'),
    sispWatches: l('Temperatura relativa à base de voo (“febre espacial”), FC e sono.', 'Temperature relative to the in-flight baseline (“space fever”), HR and sleep.'),
    countermeasure: l('Reportar sintomas ao controle ambiental; higiene, isolamento de doente e vigilância de febre.', 'Report symptoms to environmental control; hygiene, isolating the sick and fever watch.'),
    source: SOURCES.stahn2017,
  },
}

export interface DemoStep { tab: Tab; env?: EnvironmentId; crew?: string; region?: BodyRegionId | null; hazard?: HazardId | null; title: L; caption: L; ms: number }

/** ~70 s guided tour — one click, no typing, perfect for the pitch video. */
export const DEMO_STEPS: DemoStep[] = [
  { tab: 'dashboard', env: 'iss', crew: 't1', region: 'heart', hazard: null, ms: 7000,
    title: l('Dia 75 a bordo da ISS', 'Day 75 aboard the ISS'),
    caption: l('Quatro tripulantes, seis indicadores, um mapa corporal colorido. Verde = nominal.', 'Four crew members, six indicators, one color-coded body map. Green = nominal.') },
  { tab: 'dashboard', hazard: 'radiation', region: 'brain', ms: 7000,
    title: l('Os 5 hazards da NASA no corpo', 'NASA’s 5 hazards on the body'),
    caption: l('Cada hazard do Human Research Program acende os órgãos que ele afeta — e o que o SISP mede contra ele.', 'Each Human Research Program hazard lights up the organs it affects — and what SISP measures against it.') },
  { tab: 'dashboard', crew: 't3', region: 'immune', hazard: 'environment', ms: 8000,
    title: l('Febre relativa: 37,9 °C não é “normal” aqui', 'Relative fever: 37.9 °C is not “normal” here'),
    caption: l('No espaço a temperatura de repouso sobe ~1 °C. O SISP compara com a base de voo da própria pessoa e alerta antes dos 38 °C.', 'In space resting temperature rises ~1 °C. SISP compares against the person’s own in-flight baseline and flags it before 38 °C.') },
  { tab: 'dashboard', crew: 't2', region: 'brain', hazard: 'isolation', ms: 8000,
    title: l('Isolamento: o risco silencioso', 'Isolation: the silent risk'),
    caption: l('Sono caindo 10 dias seguidos + PHQ-2 positivo. Nenhum valor isolado é crítico — a tendência é.', 'Sleep falling 10 days in a row + positive PHQ-2. No single value is critical — the trend is.') },
  { tab: 'trends', crew: 't4', ms: 7000,
    title: l('Tendências com faixas clínicas', 'Trends with clinical bands'),
    caption: l('PA e glicemia subindo devagar no Tripulante 4 — o padrão de resistência à insulina visto no Twins Study.', 'BP and glucose creeping up in Crew Member 4 — the insulin-resistance pattern seen in the Twins Study.') },
  { tab: 'dashboard', env: 'marsTransit', crew: 't2', region: null, hazard: 'distance', ms: 8000,
    title: l('Agora: a caminho de Marte', 'Now: en route to Mars'),
    caption: l('Mesma tripulação, 20 min de atraso e 1,84 mSv/dia. A margem de radiação encolhe e o solo não responde a tempo.', 'Same crew, 20-min delay and 1.84 mSv/day. Radiation margin shrinks and the ground can’t answer in time.') },
  { tab: 'ground', ms: 8000,
    title: l('Escalonamento ciente do atraso', 'Delay-aware escalation'),
    caption: l('O SISP muda o protocolo: com 40 min de ida e volta, a tripulação age primeiro e envia um relatório compacto ao cirurgião de voo.', 'SISP switches protocol: with a 40-min round trip, the crew acts first and sends a compact report to the flight surgeon.') },
  { tab: 'emergency', ms: 7000,
    title: l('Manuais de emergência offline', 'Offline emergency manuals'),
    caption: l('RCP em microgravidade, lesões musculares e fraturas — passo a passo, com fontes NASA/ISS.', 'CPR in microgravity, muscle injuries and fractures — step by step, with NASA/ISS sources.') },
  { tab: 'nasa', ms: 7000,
    title: l('Dados reais da NASA', 'Real NASA data'),
    caption: l('Glicemia real da Inspiration4 (OSDR OSD-575) e eventos solares do DONKI alimentam o app.', 'Real Inspiration4 glucose (OSDR OSD-575) and DONKI solar events feed the app.') },
  { tab: 'dashboard', env: 'iss', crew: 't1', region: 'heart', hazard: null, ms: 6000,
    title: l('SISP: saúde que viaja com a tripulação', 'SISP: health that travels with the crew'),
    caption: l('Offline, baseado em evidência, pensado para quando a Terra está a 20 minutos-luz.', 'Offline, evidence-based, built for when Earth is 20 light-minutes away.') },
]
