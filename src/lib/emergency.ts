/**
 * Emergency manuals – educational summaries of PUBLIC NASA material plus current resuscitation
 * guidance. ⚠️ Not a clinical protocol. Every step cites its source; nothing here replaces
 * crew medical training, the current (non-public) ISS Medical Checklist, or the flight surgeon.
 */
import { l } from './i18n'
import type { L } from './i18n'
import type { Source } from './knowledge'
import { SOURCES } from './knowledge'

export const EM_SOURCES = {
  issChecklist: { label: 'NASA JSC-48522-E4 – ISS Integrated Medical Group (IMG) Medical Checklist (2001, public historical version; archived nasa.gov copy)', url: 'http://web.archive.org/web/20230519222418/https://www.nasa.gov/centers/johnson/pdf/163533main_ISS_Med_CL.pdf' },
  issChecklistNtrs: { label: 'NASA NTRS – ISS Medical Checklist Procedures Validation and Training (ACLS evaluated in flight tests)', url: 'https://ntrs.nasa.gov/citations/20000026308' },
  ilcor: { label: 'ILCOR CoSTR BLS 2721 – CPR in Microgravity Environments (systematic review, good-practice statements)', url: 'https://costr.ilcor.org/document/bls-2721-cpr-in-microgravity-environments' },
  nasaCpr: { label: 'NASA – Astronaut Josh Cassada practices CPR on the space station (2022)', url: 'https://www.nasa.gov/image-article/astronaut-josh-cassada-practices-cpr-space-station/' },
  hrrSca: { label: 'NASA Human Research Roadmap – Sudden Cardiac Arrest (medical condition evidence)', url: 'https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Sudden_Cardiac_Arrest.pdf' },
  aha: { label: 'American Heart Association – Adult Basic and Advanced Life Support guidelines', url: 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-and-advanced-life-support' },
  hrrBack: { label: 'NASA Human Research Roadmap – Back Injury (medical condition evidence)', url: 'https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Back_Injury.pdf' },
  hrrShoulder: { label: 'NASA Human Research Roadmap – Shoulder Dislocation (medical condition evidence)', url: 'https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Shoulder_Dislocation.pdf' },
  hrrLumbar: { label: 'NASA Human Research Roadmap – Lumbar Spine Fracture (medical condition evidence)', url: 'https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Lumbar_Spine_Fracture.pdf' },
  fractureRisk: { label: 'NASA HRP Evidence Report – Risk of Bone Fracture due to Spaceflight-induced Changes to Bone (2024)', url: 'https://ntrs.nasa.gov/api/citations/20240005190/downloads/2024%20FINAL%20HRP-F07-ERft%20R2%20Fracture.pdf' },
  muscleLoss: { label: 'NASA – Counteracting Bone and Muscle Loss in Microgravity', url: 'https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/' },
} satisfies Record<string, Source>

export interface EmStep { icon: string; text: L; src: Source[]; warning?: boolean }
export interface EmManual {
  id: 'cardiac' | 'muscle' | 'fracture'
  title: L
  subtitle: L
  color: string
  recognize: L[]
  steps: EmStep[]
  spaceNotes: { text: L; src: Source[] }[]
  callGround: L
  sources: Source[]
}

const S = EM_SOURCES

export const MANUALS: EmManual[] = [
  {
    id: 'cardiac',
    title: l('Parada cardíaca – RCP/ACLS em microgravidade', 'Cardiac arrest – CPR/ACLS in microgravity'),
    subtitle: l('Inconsciente, sem respiração normal e sem pulso', 'Unresponsive, not breathing normally, no pulse'),
    color: '#ef4444',
    recognize: [
      l('Não responde ao chamado/toque.', 'Does not respond to voice/touch.'),
      l('Abra a via aérea (inclinar cabeça, elevar queixo): ver, ouvir, sentir a respiração.', 'Open the airway (head tilt, chin lift): look, listen, feel for breathing.'),
      l('Pulso carotídeo por 5–10 s. Sem pulso = parada cardíaca.', 'Carotid pulse for 5–10 s. No pulse = cardiac arrest.'),
    ],
    steps: [
      { icon: '📣', text: l('Chame ajuda: comandante e CMO; acione o canal médico de emergência com o solo.', 'Call for help: commander and CMO; open the medical emergency channel to the ground.'), src: [S.aha, S.hrrSca] },
      { icon: '🤲', text: l('Comece as compressões JÁ com um método em que o socorrista estabiliza o paciente com o próprio corpo (ex.: Evetts–Russomano ou "reverse bear hug") até ser possível prendê-lo.', 'Start compressions NOW using a method where the rescuer stabilizes the patient with their own body (e.g., Evetts–Russomano or "reverse bear hug") until the patient can be restrained.'), src: [S.ilcor] },
      { icon: '🧰', text: l('Um tripulante faz RCP enquanto outro prepara a área: CMRS (Crew Medical Restraint System), desfibrilador, kit ALSP e pacote respiratório (RSP).', 'One crew member does CPR while another prepares the area: CMRS (Crew Medical Restraint System), defibrillator, ALSP kit and Respiratory Support Pack (RSP).'), src: [S.issChecklist] },
      { icon: '🛏️', text: l('Prenda o paciente no CMRS o quanto antes e continue com um método que gere frequência/profundidade dentro da diretriz – ex.: "handstand" (pés apoiados na parede oposta) ou ao lado do paciente com o socorrista preso por arnês.', 'Restrain the patient on the CMRS as soon as possible and continue with a method that delivers guideline rate/depth – e.g., "handstand" (feet braced on the opposite surface) or at the patient’s side with the rescuer harnessed.'), src: [S.ilcor, S.nasaCpr] },
      { icon: '⏱️', text: l('Compressões de qualidade: 100–120/min, profundidade de 5–6 cm, retorno total do tórax, mínimo de interrupções; 30:2 sem via aérea avançada.', 'High-quality compressions: 100–120/min, 5–6 cm depth, full chest recoil, minimal interruptions; 30:2 without an advanced airway.'), src: [S.aha] },
      { icon: '⚡', text: l('Cole as pás do desfibrilador, pare a RCP e analise. Choque indicado: carregue, anuncie "AFASTEM" (ninguém tocando no paciente) e dispare; retome a RCP imediatamente. Energia conforme o aparelho.', 'Attach defibrillator pads, pause CPR and analyze. If a shock is advised: charge, call "CLEAR" (nobody touching the patient) and discharge; resume CPR immediately. Energy per device.'), src: [S.issChecklist, S.aha], warning: true },
      { icon: '🫁', text: l('Ventilação com bolsa-válvula-máscara (Ambu) e cânula oral; via aérea avançada só por tripulante treinado, com o solo.', 'Ventilate with bag-valve-mask (Ambu) and oral airway; advanced airway only by a trained crew member, with the ground.'), src: [S.issChecklist] },
      { icon: '🤖', text: l('Se houver compressor torácico mecânico validado em microgravidade e a RCP manual não puder ser mantida, use-o.', 'If a chest compression device validated in microgravity is available and manual CPR cannot be sustained, use it.'), src: [S.ilcor] },
      { icon: '💊', text: l('Medicações de ACLS apenas sob orientação do flight surgeon / CMO treinado. O SISP não indica doses.', 'ACLS medications only under flight-surgeon / trained-CMO direction. SISP does not list doses.'), src: [S.issChecklist, S.issChecklistNtrs], warning: true },
      { icon: '💓', text: l('Retorno da circulação: monitore via aérea, respiração, ECG e sinais vitais a cada 5 min; cuidados pós-ressuscitação com o solo.', 'Return of circulation: monitor airway, breathing, ECG and vital signs every 5 min; post-resuscitation care with the ground.'), src: [S.issChecklist] },
    ],
    spaceNotes: [
      { text: l('Sem gravidade, o paciente e o socorrista "flutuam": sem contenção a força de compressão afasta os dois. Métodos sem contenção são temporários e difíceis de manter.', 'Without gravity, patient and rescuer float: without restraint, compression force pushes them apart. Restraint-free methods are temporary and hard to sustain.'), src: [S.ilcor] },
      { text: l('Não há estudos clínicos em órbita; as recomendações vêm de simulações (voo parabólico, suspensão, água) e são "boas práticas".', 'There are no clinical studies in orbit; recommendations come from simulations (parabolic flight, suspension, underwater) and are good-practice statements.'), src: [S.ilcor] },
      { text: l('A versão pública do checklist da ISS (2001) usava valores antigos (80–100/min, 15:2, golpe precordial) – hoje superados pelas diretrizes atuais.', 'The public ISS checklist (2001) used older values (80–100/min, 15:2, precordial thump) – superseded by current guidelines.'), src: [S.issChecklist, S.aha] },
    ],
    callGround: l('Imediatamente, em paralelo à RCP. Em Marte (até ~40 min ida e volta) a tripulação conduz sozinha.', 'Immediately, in parallel with CPR. At Mars (up to ~40 min round trip) the crew runs it alone.'),
    sources: [S.ilcor, S.issChecklist, S.issChecklistNtrs, S.nasaCpr, S.hrrSca, S.aha],
  },
  {
    id: 'muscle',
    title: l('Lesões musculares – distensão e entorse', 'Muscle injuries – strains and sprains'),
    subtitle: l('Dor, inchaço ou limitação após esforço/exercício, sem deformidade', 'Pain, swelling or limited motion after effort/exercise, no deformity'),
    color: '#f97316',
    recognize: [
      l('Dor localizada ao mover ou contrair o músculo/articulação.', 'Localized pain on moving or contracting the muscle/joint.'),
      l('Inchaço, hematoma ou espasmo, mas pulso e sensibilidade normais abaixo da lesão.', 'Swelling, bruising or spasm, but normal pulse and sensation below the injury.'),
      l('Deformidade, osso exposto, dormência ou sem pulso → trate como FRATURA.', 'Deformity, exposed bone, numbness or no pulse → treat as FRACTURE.'),
    ],
    steps: [
      { icon: '🧊', text: l('Frio imediato reduz o inchaço: toalha molhada em água fria sobre a lesão por 10 min; repita 3 vezes.', 'Immediate cold reduces swelling: towel wet with cold water on the injury for 10 min; repeat 3 times.'), src: [S.issChecklist] },
      { icon: '🩹', text: l('Imobilize com bandagem elástica em "oito" ou tala SAM com bandagem (corte a tala se preciso). O solo orienta conforme a lesão.', 'Immobilize with a figure-eight elastic bandage or a SAM splint with bandage (cut the splint if needed). The ground advises based on the injury.'), src: [S.issChecklist] },
      { icon: '📡', text: l('O solo orienta a conduta (incluindo atividade e exercício) conforme a lesão.', 'The ground advises on care (including activity and exercise) based on the injury.'), src: [S.issChecklist] },
      { icon: '💊', text: l('Analgésico/anti-inflamatório do kit médico só conforme o checklist e o flight surgeon (o SISP não indica doses).', 'Analgesic/anti-inflammatory from the medical kit only per the checklist and flight surgeon (SISP does not list doses).'), src: [S.issChecklist], warning: true },
      { icon: '♨️', text: l('Após 24 h: calor local – toalha com água morna por 10 min, presa com bandagem; até 3 vezes ao dia.', 'After 24 h: local heat – towel with warm water for 10 min, secured with a bandage; up to 3 times a day.'), src: [S.issChecklist] },
      { icon: '📝', text: l('Dica do SISP: anote dor, inchaço e mobilidade e inclua no relatório ao solo.', 'SISP tip: note pain, swelling and mobility and include them in the ground report.'), src: [] },
    ],
    spaceNotes: [
      { text: l('Em microgravidade músculos e ossos perdem massa sem carga; o exercício diário é contramedida, mas também é fonte de lesões.', 'In microgravity, unloaded muscles and bones lose mass; daily exercise is the countermeasure but also a source of injury.'), src: [S.muscleLoss] },
      { text: l('Dor nas costas é comum em voo (alongamento da coluna); lesões de coluna exigem avaliação com o solo.', 'Back pain is common in flight (spinal elongation); spine injuries require ground evaluation.'), src: [S.hrrBack] },
    ],
    callGround: l('No próximo passe se leve; imediatamente se houver dormência, perda de força ou suspeita de fratura.', 'Next pass if mild; immediately if numbness, weakness or suspected fracture.'),
    sources: [S.issChecklist, S.muscleLoss, S.hrrBack],
  },
  {
    id: 'fracture',
    title: l('Fraturas e luxações', 'Fractures and dislocations'),
    subtitle: l('Deformidade, dor intensa, crepitação ou osso exposto', 'Deformity, severe pain, crepitus or exposed bone'),
    color: '#eab308',
    recognize: [
      l('Deformidade, dor intensa no osso, incapacidade de mover, crepitação.', 'Deformity, severe bone pain, inability to move, crepitus.'),
      l('Luxações (ex.: ombro) são tratadas como fraturas.', 'Dislocations (e.g., shoulder) are treated as fractures.'),
      l('Fraturas de pelve/coxa podem causar grande perda de sangue e choque.', 'Pelvis/thigh fractures can cause major blood loss and shock.'),
    ],
    steps: [
      { icon: '🫀', text: l('Sem pulso ou respiração → vá para o manual de Parada cardíaca. Inconsciente → via aérea e ventilação.', 'No pulse or breathing → go to the Cardiac arrest manual. Unconscious → airway and ventilation.'), src: [S.issChecklist], warning: true },
      { icon: '🛏️', text: l('Registre sinais vitais a cada 5 min (pressão, pulso, respiração, temperatura).', 'Record vital signs every 5 min (BP, pulse, respiration, temperature).'), src: [S.issChecklist] },
      { icon: '🧤', text: l('Sangramento: luvas e compressão direta com gaze.', 'Bleeding: gloves and direct pressure with gauze.'), src: [S.issChecklist] },
      { icon: '🖐️', text: l('Verifique pulso e sensibilidade ABAIXO da fratura.', 'Check pulse and sensation BELOW the fracture.'), src: [S.issChecklist] },
      { icon: '⚠️', text: l('Sem pulso ou sensibilidade abaixo da lesão: contate o flight surgeon IMEDIATAMENTE para instruções de redução. Com pulso: imobilize SEM corrigir a fratura.', 'No pulse or sensation below the injury: contact the flight surgeon IMMEDIATELY for reduction instructions. Pulse present: splint WITHOUT correcting the fracture.'), src: [S.issChecklist], warning: true },
      { icon: '🩹', text: l('Fratura exposta (osso pela pele ou por projétil): cubra com gaze, atadura e bandagem elástica. Dedos: tala de dedo.', 'Open fracture (bone through skin or projectile): cover with gauze, roller dressing and elastic bandage. Fingers: finger splint.'), src: [S.issChecklist] },
      { icon: '🦴', text: l('Imobilize com tala SAM + atadura + bandagem elástica (veja as instruções da tala).', 'Splint with SAM splint + roller dressing + elastic bandage (see the splint instructions).'), src: [S.issChecklist] },
      { icon: '📡', text: l('Contate o flight surgeon.', 'Contact the flight surgeon.'), src: [S.issChecklist] },
    ],
    spaceNotes: [
      { text: l('A perda óssea de 1–1,5% por mês no quadril e coluna pode aumentar o risco de fratura, especialmente ao retornar à gravidade ou em gravidade parcial.', 'Bone loss of 1–1.5% per month at hip and spine may raise fracture risk, especially on return to gravity or in partial gravity.'), src: [S.fractureRisk, SOURCES.bone] },
      { text: l('Não há luxação de ombro registrada no espaço, mas ela é possível ao manusear grandes massas ou em EVA.', 'No shoulder dislocation has been reported in space, but it is possible when moving large masses or during EVA.'), src: [S.hrrShoulder] },
      { text: l('Fraturas de coluna lombar são raras, mas o risco cresce com a desmineralização e com trauma em pouso/EVA.', 'Lumbar spine fractures are rare, but risk rises with demineralization and with landing/EVA trauma.'), src: [S.hrrLumbar] },
    ],
    callGround: l('Sempre. Imediatamente se faltar pulso/sensibilidade abaixo da lesão, fratura exposta, de pelve/fêmur ou sinais de choque.', 'Always. Immediately if pulse/sensation is missing below the injury, open fracture, pelvis/femur fracture or signs of shock.'),
    sources: [S.issChecklist, S.fractureRisk, S.hrrShoulder, S.hrrLumbar, SOURCES.bone],
  },
]
