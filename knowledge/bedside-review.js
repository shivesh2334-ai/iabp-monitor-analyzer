const numeric = value => String(value ?? '').trim() !== '' &&
  Number.isFinite(Number(value)) && Number(value) >= 0;
const shown = (value, unit) => numeric(value) ? Number(value) + ' ' + unit : null;
const compare = (a, b) => Number(a) - Number(b);

export function bedsideReview(p) {
  const sections = [];
  const add = (title, lines) => sections.push({ title, lines: lines.filter(Boolean) });
  const pressure = [
    ['Displayed systolic', p.systolic], ['Displayed diastolic', p.diastolic],
    ['Displayed MAP', p.map], ['Diastolic augmentation', p.augmentedPressure]
  ].filter(([, value]) => numeric(value)).map(([label, value]) => label + ' ' + shown(value, 'mmHg'));
  add('Hemodynamics and augmentation', [
    [shown(p.heartRate, 'bpm') && 'Heart rate ' + shown(p.heartRate, 'bpm'), ...pressure].filter(Boolean).join(' · ') ||
      'No heart rate or displayed pressures were recorded.',
    numeric(p.augmentedPressure) && numeric(p.systolic) ?
      'Augmentation minus displayed systolic: ' + compare(p.augmentedPressure, p.systolic) +
      ' mmHg. The displayed systolic label alone does not identify an unassisted beat.' : null,
    numeric(p.augmentedPressure) && numeric(p.unassistedSystolic) ?
      'Augmentation minus unassisted systolic: ' + compare(p.augmentedPressure, p.unassistedSystolic) + ' mmHg.' :
      'The augmentation-to-unassisted systolic comparison needs both explicitly labelled values.',
    'Displayed pressures and augmentation alone cannot establish organ perfusion. [response]'
  ]);
  const settings = [['Device', p.deviceModel], ['Mode', p.mode], ['Assist ratio', p.assistRatio],
    ['Trigger', p.trigger], ['Pressure source', p.pressureSource], ['Augmentation alarm', p.augmentationAlarm]];
  add('Settings, trigger and alarms', [
    settings.filter(([, value]) => value).map(([label, value]) => label + ': ' + value).join(' · ') ||
      'No device settings were recorded.',
    p.rhythm && p.rhythm !== 'Not assessable' ? 'Reported rhythm: ' + p.rhythm + '.' : 'Rhythm was not established.',
    p.trigger === 'ECG' ? 'ECG trigger reliability requires visible trigger markers and a readable ECG signal. [position]' : null
  ]);
  const pairs = [['Systolic', p.assistedSystolic, p.unassistedSystolic], ['End-diastolic', p.assistedEDP, p.unassistedEDP]];
  add('Waveform timing and afterload', [
    ...pairs.map(([label, assisted, unassisted]) => numeric(assisted) && numeric(unassisted) ?
      label + ' assisted minus unassisted: ' + compare(assisted, unassisted) + ' mmHg. [nepean-waveforms]' :
      label + ' comparison requires a clearly labelled assisted and unassisted beat. [nepean-waveforms]'),
    p.timingSeen && p.timingSeen !== 'Not sure' ? 'Clinician-recorded timing: ' + p.timingSeen + '.' :
      'Timing review depends on the dicrotic notch, inflation onset and the relation of deflation to ejection. [webb-timing]'
  ]);
  return sections;
}
