'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Target, X } from 'lucide-react';
import { HeartGate, HeartChip } from '@/components/economy/HeartGate';
import { ActivityMusic } from '@/components/music/ActivityMusic';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Markdown } from '@/components/Markdown';
import { useT } from '@/i18n/useT';
import { useApp } from '@/lib/store';
import { scoreExamQuestion, examAnswerReady, examAnswerAttempted, type ExamAnswer } from '@/lib/exam-scoring';
import type { EntQuestion } from '@/lib/ent';
import type { L } from '@/lib/types';
import { tx } from '@/lib/text';
import { cn } from '@/lib/cn';

export function ExamScreen(props: { kind: 'ent' | 'section-test'; id: string; title: L; questions: EntQuestion[] }) {
  const [runId] = useState(() => crypto.randomUUID());
  return <HeartGate kind={props.kind} runId={runId}><ExamSession {...props} /></HeartGate>;
}

function ExamSession({ kind, id, title, questions }: { kind: 'ent' | 'section-test'; id: string; title: L; questions: EntQuestion[] }) {
  const { t, l, lang } = useT();
  const [answers, setAnswers] = useState<Record<string, ExamAnswer>>({});
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);
  const submitted = useRef(false);
  const [answerTimes, setAnswerTimes] = useState<Record<string, number>>({});
  const visibleSince = useRef(0);
  useEffect(() => {
    started.current = Date.now();
    visibleSince.current = Date.now();
  }, []);
  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [finished]);
  const question = questions[index];
  const current = answers[question.id];
  const complete = questions.filter(question => examAnswerReady(question, answers[question.id])).length;
  const scores = questions.map(question => scoreExamQuestion(question, answers[question.id], lang));
  const points = scores.reduce((sum, score) => sum + score.points, 0);
  const max = scores.reduce((sum, score) => sum + score.max, 0);
  const write = (value: ExamAnswer) => setAnswers(previous => ({ ...previous, [question.id]: value }));
  const go = useCallback((next: number) => {
    const now = Date.now();
    const duration = now - visibleSince.current;
    setAnswerTimes(times => ({ ...times, [question.id]: (times[question.id] ?? 0) + duration }));
    visibleSince.current = now;
    setIndex(next);
    window.scrollTo({ top: 0 });
  }, [question.id]);
  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    const times: Record<string, number> = { ...answerTimes, [question.id]: (answerTimes[question.id] ?? 0) + Date.now() - visibleSince.current };
    for (const [i, score] of scores.entries()) {
      if (!examAnswerAttempted(questions[i], answers[score.record.stepId])) continue;
      useApp.getState().recordAnswer({ ...score.record, timeMs: times[score.record.stepId] ?? 0 }, score.record.correct ? 10 : 0);
    }
    if (complete === questions.length) useApp.getState().recordAssessment(kind, id, max ? points / max : 0, elapsed);
    else useApp.getState().recordStudyTime(elapsed);
    setConfirm(false);
    setFinished(true);
  }, [answers, answerTimes, complete, elapsed, id, kind, max, points, question.id, questions, scores]);
  if (finished) return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-8">
    <h1 className="text-2xl font-extrabold">{t('exam.result')}</h1><p className="font-bold text-muted">{l(title)}</p>
    <Card className="flex items-center gap-4 border-gold"><Target size={36} className="text-gold"/><div><p className="text-4xl font-extrabold">{points}/{max}</p><p className="font-bold text-muted">{t('exam.points')}</p></div></Card>
    <p className="font-semibold text-muted">{t('exam.reviewHint')}</p>
    <div className="flex flex-col gap-3">{scores.map((score, i) => <Card key={questions[i].id} className={score.record.correct ? 'border-success/40' : 'border-danger/40'}>
      <p className="mb-2 flex items-center gap-2 font-extrabold">{score.record.correct ? <Check size={18} className="text-success"/> : <X size={18} className="text-danger"/>}{i + 1} · {score.points}/{score.max}</p>
      <Markdown>{tx(questions[i].prompt, lang)}</Markdown><p className="mt-2 text-sm"><b>{t('stats.given')}:</b> {score.record.given}</p><p className="mt-1 text-sm"><b>{t('stats.expected')}:</b> {score.record.expected}</p>
      <Markdown className="mt-3 rounded-xl bg-primary-soft p-3 text-sm">{tx(questions[i].explanation, lang)}</Markdown>
    </Card>)}</div><ButtonLink href="/stats">{t('nav.stats')}</ButtonLink><ButtonLink variant="secondary" href="/practice">{t('common.back')}</ButtonLink>
  </main>;
  return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 pb-10 pt-4">
    <header className="flex items-center justify-between gap-3"><Link href="/practice" aria-label={t('common.back')} className="rounded-xl p-2 text-muted"><X size={24}/></Link><p className="min-w-0 flex-1 truncate font-extrabold">{l(title)}</p><HeartChip/><span className="font-mono text-sm text-muted">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span></header>
    <ProgressBar value={complete / questions.length}/><p className="text-sm font-bold text-muted">{t('exam.completed', { n: complete, total: questions.length })}</p>
    <ActivityMusic mode="test"/>
    <nav aria-label={t('exam.questions')} className="flex flex-wrap gap-1.5">{questions.map((question, i) => <button key={question.id} type="button" onClick={() => go(i)} aria-current={index === i ? 'step' : undefined} aria-label={t('exam.questionNumber', { n: i + 1 })} className={cn('h-9 w-9 rounded-lg border text-sm font-extrabold', index === i ? 'border-primary bg-primary-soft text-primary' : examAnswerReady(question, answers[question.id]) ? 'border-success/30 bg-success-soft text-success-strong' : 'border-border bg-surface text-muted')}>{i + 1}</button>)}</nav>
    <Card>
      <h1 className="mb-2 text-lg font-extrabold">{t('exam.questionNumber', { n: index + 1 })}</h1>
      <Markdown className="text-lg">{tx(question.prompt, lang)}</Markdown>
      <p className="my-3 text-sm font-bold text-muted">{t(question.type === 'multi' ? 'exam.multi' : question.type === 'ent-match' ? 'exam.match' : 'exam.single')}</p>
      {question.type === 'ent-match' ? <div className="flex flex-col gap-3">{question.left.map((left, i) => <label key={i} className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 font-bold">{tx(left, lang)}<select aria-label={tx(left, lang)} value={Array.isArray(current) ? current[i] ?? -1 : -1} onChange={event => { const next = Array.isArray(current) ? [...current] : question.left.map(() => -1); next[i] = Number(event.target.value); write(next); }} className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3"><option value={-1}>{t('exam.choose')}</option>{question.options.map((option, j) => <option key={j} value={j}>{tx(option, lang)}</option>)}</select></label>)}</div> : <div role={question.type === 'choice' ? 'radiogroup' : 'group'} aria-label={t('exam.answers')} className="flex flex-col gap-2">{question.options.map((option, i) => {
        const selected = Array.isArray(current) ? current.includes(i) : current === i;
        return <button type="button" key={i} role={question.type === 'choice' ? 'radio' : 'checkbox'} aria-checked={selected} onClick={() => write(question.type === 'choice' ? i : selected ? (Array.isArray(current) ? current.filter(index => index !== i) : []) : [...(Array.isArray(current) ? current : []), i])} className={cn('flex min-h-13 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-bold', selected ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-surface-2')}><span className="font-mono">{String.fromCharCode(65 + i)}</span><span className="min-w-0">{tx(option, lang)}</span></button>;
      })}</div>}
    </Card>
    <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>{t('common.back')}</Button>{index + 1 < questions.length && <Button onClick={() => go(index + 1)}>{t('common.continue')}</Button>}<Button className="ml-auto" variant="success" onClick={() => setConfirm(true)}>{t('exam.finish')}</Button></div>
    <Modal open={confirm} onClose={() => setConfirm(false)} label={t('exam.finish')}><h2 className="text-xl font-extrabold">{t('exam.finish')}</h2><p className="my-3 font-semibold">{complete === questions.length ? t('exam.allDone') : t('exam.unanswered', { n: questions.length - complete })}</p><div className="flex gap-3"><Button variant="secondary" onClick={() => setConfirm(false)}>{t('exam.return')}</Button><Button onClick={submit}>{t('exam.submit')}</Button></div></Modal>
  </main>;
}
