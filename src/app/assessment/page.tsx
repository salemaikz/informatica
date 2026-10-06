'use client';

import { useState } from 'react';
import { UNITS } from '@/content/course';
import { ExamScreen } from '@/components/exam/ExamScreen';
import { buildSectionTest } from '@/lib/section-tests';
import { Card } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useT } from '@/i18n/useT';

export default function AssessmentPage() {
  const { t, l } = useT();
  const [variant, setVariant] = useState(1);
  const [exam, setExam] = useState<ReturnType<typeof buildSectionTest>>();
  if (exam) return <ExamScreen kind="section-test" {...exam}/>;
  return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-8"><h1 className="text-3xl font-extrabold">{t('practice.section')}</h1><p className="font-semibold text-muted">{t('practice.sectionHint')}</p><label className="flex items-center gap-3 font-bold">{t('exam.variantLabel')}<select className="min-h-11 rounded-xl border-2 border-border bg-surface px-3" value={variant} onChange={event => setVariant(Number(event.target.value))}>{Array.from({ length: 6 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>{UNITS.map(unit => {
    const test = buildSectionTest(unit.id, variant);
    return <Card key={unit.id}><h2 className="mb-3 text-lg font-extrabold">{l(unit.title)}</h2><Button disabled={!test} onClick={() => setExam(test)}>{t('common.start')} · {test?.questions.length} · {t('practice.heartCost')}</Button></Card>;
  })}<ButtonLink href="/practice" variant="ghost">{t('common.back')}</ButtonLink></main>;
}
