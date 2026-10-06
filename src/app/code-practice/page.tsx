'use client';

import { useState } from 'react';
import { buildCodePractice } from '@/lib/generators';
import { LessonPlayer } from '@/components/lesson/LessonPlayer';
import { useT } from '@/i18n/useT';

export default function CodePracticePage() {
  const { t } = useT();
  const [steps] = useState(() => buildCodePractice(Math.floor(Math.random() * 1_000_000), 12));
  return <LessonPlayer kind="drill" runKind="code" title={t('practice.code')} steps={steps}/>;
}
