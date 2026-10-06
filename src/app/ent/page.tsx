'use client';

import { useState } from 'react';
import { buildEntMock } from '@/lib/ent';
import { ExamScreen } from '@/components/exam/ExamScreen';
import { useT } from '@/i18n/useT';
import { Card } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function EntPage() {
  const { t } = useT();
  const [variant, setVariant] = useState<number | null>(null);
  const [mock, setMock] = useState<ReturnType<typeof buildEntMock> | null>(null);
  if (mock) return <ExamScreen kind="ent" id={mock.id} title={mock.title} questions={mock.questions}/>;
  return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-8"><h1 className="text-3xl font-extrabold">{t('prac.ent')}</h1><Card><p className="font-semibold">{t('exam.format')}</p><p className="mt-3 text-sm font-semibold text-muted">{t('exam.practiceHint')}</p></Card><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 12 }, (_, i) => <Button variant="secondary" key={i} onClick={() => setVariant(i + 1)} className={variant === i + 1 ? 'border-primary bg-primary-soft' : ''}>{t('exam.variant', { n: i + 1 })}</Button>)}</div><Button size="lg" disabled={variant === null} onClick={() => variant !== null && setMock(buildEntMock(2026100600 + variant))}>{t('exam.openVariant')}</Button><ButtonLink href="/practice" variant="ghost">{t('common.back')}</ButtonLink></main>;
}
