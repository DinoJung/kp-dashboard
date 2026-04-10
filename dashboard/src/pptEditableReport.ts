import PptxGenJS from 'pptxgenjs'

type MetricCardData = {
  title: string
  value: string
  delta?: string
  helper?: string
  accent: string
}

type TableRows = string[][]

type AdSourceCard = {
  label: string
  images: string[]
}

type CalendarData = {
  monthLabel: string
  monthKey: string
  weeks: Array<Array<number | null>>
  holidays: Set<number>
}

type EditableReportArgs = {
  reportMonthKey: string
  monthLabelKorean: string
  monthEndLabel: string
  exposureFirstBusinessDay: string
  logoSrc: string
  coverTitle: string
  resultMetricCards: MetricCardData[]
  sixMonthTableRows: TableRows
  promotionRows: TableRows
  adMetricCards: MetricCardData[]
  campaignRows: TableRows
  adSourceCards: AdSourceCard[]
  nextPlanCalendar: CalendarData | null
  calendarWeekdays: string[]
}

const px = (value: number) => Number((value / 144).toFixed(4))
const PANEL_LINE = 'E5E7EB'
const PALE_GRAY = 'F8FAFC'
const BODY_TEXT = '111827'
const MUTED_TEXT = '6B7280'
const ACCENT_AMBER = 'F59E0B'
const LIGHT_AMBER = 'FEF3C7'
const FONT_FACE = 'Pretendard Variable'

export async function generateEditableReportPpt(args: EditableReportArgs) {
  const pptx = new PptxGenJS()
  const roundRect = pptx.ShapeType.roundRect
  const imageCache = new Map<string, string>()
  const dimensionCache = new Map<string, { width: number; height: number }>()

  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Hermes'
  pptx.company = 'Thekary'
  pptx.subject = `Thekary Point ${args.reportMonthKey} editable report`
  pptx.title = `Thekary Point Report ${args.reportMonthKey}`

  async function toDataUrl(src: string) {
    const cached = imageCache.get(src)
    if (cached) return cached
    const response = await fetch(src)
    if (!response.ok) throw new Error(`이미지를 불러올 수 없습니다: ${src}`)
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error(`이미지 변환 실패: ${src}`))
      reader.readAsDataURL(blob)
    })
    imageCache.set(src, dataUrl)
    return dataUrl
  }

  async function getImageSize(src: string) {
    const cached = dimensionCache.get(src)
    if (cached) return cached
    const dataUrl = await toDataUrl(src)
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error(`이미지 크기 확인 실패: ${src}`))
      image.src = dataUrl
    })
    dimensionCache.set(src, size)
    return size
  }

  function addPanel(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, fill = 'FFFFFF', line = PANEL_LINE, transparency = 0) {
    slide.addShape(roundRect, {
      x,
      y,
      w,
      h,
      rectRadius: 0.12,
      line: { color: line, width: 1 },
      fill: { color: fill, transparency },
    })
  }

  function addHeader(slide: PptxGenJS.Slide, title: string, activeStep: 'summary' | 'exposure' | 'ad' | 'next-plan', logoData: string) {
    slide.addText('THEKARY POINT REPORT', {
      x: px(96), y: px(84), w: px(420), h: px(20),
      fontFace: FONT_FACE, fontSize: 12.5, bold: true, color: ACCENT_AMBER,
    })
    slide.addText(title, {
      x: px(96), y: px(108), w: px(900), h: px(42),
      fontFace: FONT_FACE, fontSize: 29, bold: true, color: BODY_TEXT,
    })
    const navLabels = [
      { key: 'summary', label: 'SUMMARY' },
      { key: 'exposure', label: 'EXPOSURE' },
      { key: 'ad', label: 'AD' },
      { key: 'next-plan', label: 'NEXT PLAN' },
    ] as const
    let navX = px(96)
    navLabels.forEach((step) => {
      const width = step.label === 'NEXT PLAN' ? px(156) : px(126)
      slide.addShape(roundRect, {
        x: navX,
        y: px(164),
        w: width,
        h: px(44),
        rectRadius: 0.16,
        line: { color: step.key === activeStep ? 'F2C14E' : 'D1D5DB', width: 1 },
        fill: { color: step.key === activeStep ? LIGHT_AMBER : 'D1D5DB' },
      })
      slide.addText(step.label, {
        x: navX,
        y: px(174),
        w: width,
        h: px(18),
        fontFace: FONT_FACE,
        fontSize: 12.5,
        bold: true,
        align: 'center',
        color: step.key === activeStep ? BODY_TEXT : 'FFFFFF',
      })
      navX += width + px(14)
    })
    slide.addImage({ data: logoData, x: px(1692), y: px(54), w: px(156), h: px(48) })
  }

  function addMetricCard(slide: PptxGenJS.Slide, card: MetricCardData, x: number, y: number, w: number, h: number, compact = false) {
    addPanel(slide, x, y, w, h)
    slide.addShape(roundRect, {
      x,
      y,
      w,
      h: px(4),
      rectRadius: 0.03,
      line: { color: card.accent, width: 0 },
      fill: { color: card.accent },
    })
    slide.addText(card.title, {
      x: x + px(18), y: y + px(16), w: w - px(36), h: px(18),
      fontFace: FONT_FACE, fontSize: compact ? 10.5 : 11, bold: true, color: BODY_TEXT,
    })
    slide.addText(card.value, {
      x: x + px(18), y: y + px(compact ? 44 : 46), w: w - px(36), h: px(28),
      fontFace: FONT_FACE, fontSize: compact ? 16 : 18, bold: true, color: BODY_TEXT,
      align: compact ? 'right' : 'left',
    })
    if (card.delta) {
      slide.addText(card.delta, {
        x: x + px(18), y: y + px(compact ? 78 : 80), w: w - px(36), h: px(16),
        fontFace: FONT_FACE, fontSize: 9, bold: true, color: BODY_TEXT,
      })
    }
    if (card.helper) {
      slide.addText(card.helper, {
        x: x + px(18), y: y + px(compact ? 96 : 100), w: w - px(36), h: px(16),
        fontFace: FONT_FACE, fontSize: 8.5, color: MUTED_TEXT,
      })
    }
  }

  function addPanelTitle(slide: PptxGenJS.Slide, eyebrow: string, title: string, x: number, y: number, w: number) {
    if (eyebrow) {
      slide.addText(eyebrow, { x, y, w, h: px(16), fontFace: FONT_FACE, fontSize: 10, bold: true, color: ACCENT_AMBER })
    }
    slide.addText(title, { x, y: y + px(18), w, h: px(24), fontFace: FONT_FACE, fontSize: 18, bold: true, color: BODY_TEXT })
  }

  function makeTableRows(rows: TableRows, headerFill = 'F3F4F6'): any {
    return rows.map((row, rowIndex) =>
      row.map((text) => ({
        text,
        options: rowIndex === 0
          ? { bold: true, fill: { color: headerFill }, align: 'center' }
          : text === 'Total'
            ? { bold: true }
            : {},
      })),
    ) as any
  }

  async function addContainedImage(slide: PptxGenJS.Slide, src: string, x: number, y: number, w: number, h: number) {
    const data = await toDataUrl(src)
    const size = await getImageSize(src)
    const imageRatio = size.width / size.height
    const boxRatio = w / h
    let drawW = w
    let drawH = h
    if (imageRatio > boxRatio) {
      drawH = w / imageRatio
    } else {
      drawW = h * imageRatio
    }
    slide.addImage({ data, x: x + (w - drawW) / 2, y: y + (h - drawH) / 2, w: drawW, h: drawH })
  }

  const logoData = await toDataUrl(args.logoSrc)

  const cover = pptx.addSlide()
  cover.background = { color: 'FFFFFF' }
  cover.addText('THEKARY POINT REPORT', {
    x: px(520), y: px(320), w: px(880), h: px(36), fontFace: FONT_FACE, fontSize: 38, bold: true, align: 'center', color: MUTED_TEXT,
  })
  cover.addText('더캐리포인트', {
    x: px(420), y: px(430), w: px(450), h: px(60), fontFace: FONT_FACE, fontSize: 38, bold: true, align: 'right', color: '9CA3AF',
  })
  cover.addText(args.coverTitle, {
    x: px(890), y: px(430), w: px(650), h: px(60), fontFace: FONT_FACE, fontSize: 38, bold: true, color: ACCENT_AMBER,
  })
  cover.addText('마케팅 2팀', { x: px(760), y: px(560), w: px(400), h: px(22), fontFace: FONT_FACE, fontSize: 15, align: 'center', color: MUTED_TEXT })
  cover.addText(args.monthEndLabel, { x: px(760), y: px(590), w: px(400), h: px(22), fontFace: FONT_FACE, fontSize: 15, align: 'center', color: MUTED_TEXT })
  cover.addImage({ data: logoData, x: px(820), y: px(890), w: px(280), h: px(72) })

  const result = pptx.addSlide()
  result.background = { color: 'FFFFFF' }
  addHeader(result, `${args.monthLabelKorean} RESULT`, 'summary', logoData)
  const metricGap = px(16)
  const metricW = px((1728 - 16 * 6) / 7)
  args.resultMetricCards.forEach((card, index) => {
    addMetricCard(result, card, px(96) + index * (metricW + metricGap), px(228), metricW, px(138))
  })
  const summaryX = px(96)
  const panelsY = px(392)
  const summaryW = px(982)
  const promotionX = summaryX + summaryW + px(24)
  const promotionW = px(722)
  const panelH = px(522)
  addPanel(result, summaryX, panelsY, summaryW, panelH)
  addPanelTitle(result, '', '최근 6개월 핵심 지표 추이', summaryX + px(26), panelsY + px(20), summaryW - px(52))
  result.addTable(makeTableRows(args.sixMonthTableRows), {
    x: summaryX + px(22), y: panelsY + px(72), w: summaryW - px(44), h: panelH - px(92),
    fontFace: FONT_FACE, fontSize: 8.5, color: BODY_TEXT, border: { color: PANEL_LINE, pt: 1 },
    fill: { color: 'FFFFFF' }, margin: 0.04, rowH: px(48), autoFit: false, align: 'center',
  } as any)
  addPanel(result, promotionX, panelsY, promotionW, panelH)
  addPanelTitle(result, '프로모션', '포인트현황', promotionX + px(26), panelsY + px(20), promotionW - px(52))
  result.addTable(makeTableRows(args.promotionRows), {
    x: promotionX + px(22), y: panelsY + px(72), w: promotionW - px(44), h: panelH - px(92),
    fontFace: FONT_FACE, fontSize: 8.5, color: BODY_TEXT, border: { color: PANEL_LINE, pt: 1 },
    fill: { color: 'FFFFFF' }, margin: 0.04, rowH: px(44), autoFit: false, align: 'center',
  } as any)

  const exposure = pptx.addSlide()
  exposure.background = { color: 'FFFFFF' }
  addHeader(exposure, `${args.monthLabelKorean} 브랜드 사이트 팝업`, 'exposure', logoData)
  exposure.addText(`더캐리포인트 가입 유도 팝업 | ${args.exposureFirstBusinessDay} 10:00`, {
    x: px(96), y: px(228), w: px(1500), h: px(32), fontFace: FONT_FACE, fontSize: 18, bold: true, color: BODY_TEXT,
  })
  exposure.addText('이벤트페이지(KP), 브랜드 홈페이지 메인홈(BP, BPU, IB, KR), 마이페이지(KR)', {
    x: px(96), y: px(268), w: px(1520), h: px(26), fontFace: FONT_FACE, fontSize: 14, bold: true, color: '4B5563',
  })
  addPanel(exposure, px(96), px(328), px(1728), px(656), 'FFFFFF', 'D1D5DB')

  const ad = pptx.addSlide()
  ad.background = { color: 'FFFFFF' }
  addHeader(ad, `${args.monthLabelKorean} AD`, 'ad', logoData)
  const adMetricGap = px(14)
  const adMetricW = px((1728 - 14 * 4) / 5)
  args.adMetricCards.forEach((card, index) => {
    addMetricCard(ad, card, px(96) + index * (adMetricW + adMetricGap), px(220), adMetricW, px(92), true)
  })
  addPanel(ad, px(96), px(330), px(1728), px(310))
  addPanelTitle(ad, '광고 상세', 'META 캠페인 성과', px(122), px(350), px(400))
  ad.addTable(makeTableRows(args.campaignRows), {
    x: px(118), y: px(400), w: px(1684), h: px(218),
    fontFace: FONT_FACE, fontSize: 9, color: BODY_TEXT, border: { color: PANEL_LINE, pt: 1 },
    fill: { color: 'FFFFFF' }, margin: 0.04, rowH: px(44), autoFit: false, align: 'center',
  } as any)
  const galleryW = px((1728 - 16) / 2)
  for (const [index, card] of args.adSourceCards.entries()) {
    const panelX = px(96) + index * (galleryW + px(16))
    addPanel(ad, panelX, px(660), galleryW, px(300))
    ad.addText('AD SOURCE', {
      x: panelX + px(24), y: px(684), w: px(130), h: px(16), fontFace: FONT_FACE, fontSize: 10, bold: true, color: ACCENT_AMBER,
    })
    ad.addText(card.label, {
      x: panelX + px(24), y: px(706), w: px(130), h: px(24), fontFace: FONT_FACE, fontSize: 18, bold: true, color: BODY_TEXT,
    })
    addPanel(ad, panelX + px(150), px(676), galleryW - px(174), px(268), PALE_GRAY, 'F1F5F9')
    const slotGap = px(12)
    const slotW = px(120)
    const imageBoxH = px(236)
    const imageStartX = panelX + px(182)
    if (card.images[0]) {
      await addContainedImage(ad, card.images[0], imageStartX, px(690), slotW, imageBoxH)
    }
    if (card.images[1]) {
      await addContainedImage(ad, card.images[1], imageStartX + slotW + slotGap, px(690), slotW, imageBoxH)
    }
  }

  const plan = pptx.addSlide()
  plan.background = { color: 'FFFFFF' }
  addHeader(plan, `${args.monthLabelKorean} NEXT PLAN`, 'next-plan', logoData)
  addPanel(plan, px(96), px(228), px(1728), px(724))
  addPanelTitle(plan, '다음달 일정', args.nextPlanCalendar ? `${args.nextPlanCalendar.monthLabel} 캘린더` : '캘린더 준비 중', px(122), px(250), px(600))
  if (args.nextPlanCalendar) {
    const boardX = px(122)
    const boardY = px(318)
    const totalW = px(1676)
    const gap = px(12)
    const calendarW = totalW * 0.6
    const weeklyW = totalW * 0.4
    const dayCellW = (calendarW - gap * 6) / 7
    const headerH = px(44)
    const bodyH = px(94)
    args.calendarWeekdays.forEach((weekday, index) => {
      const x = boardX + index * (dayCellW + gap)
      addPanel(plan, x, boardY, dayCellW, headerH, PALE_GRAY, PALE_GRAY)
      plan.addText(weekday, {
        x, y: boardY + px(10), w: dayCellW, h: px(18),
        fontFace: FONT_FACE, fontSize: 11.5, bold: true, align: 'center', color: index === 0 ? 'DC2626' : MUTED_TEXT,
      })
    })
    addPanel(plan, boardX + calendarW + gap, boardY, weeklyW - gap, headerH, PALE_GRAY, PALE_GRAY)
    plan.addText('주요일정', {
      x: boardX + calendarW + gap, y: boardY + px(10), w: weeklyW - gap, h: px(18),
      fontFace: FONT_FACE, fontSize: 11.5, bold: true, align: 'center', color: BODY_TEXT,
    })
    args.nextPlanCalendar.weeks.forEach((week, weekIndex) => {
      const rowY = boardY + headerH + gap + weekIndex * (bodyH + gap)
      week.forEach((day, dayIndex) => {
        const x = boardX + dayIndex * (dayCellW + gap)
        addPanel(plan, x, rowY, dayCellW, bodyH, day === null ? 'F9FAFB' : 'FFFFFF', PANEL_LINE)
        if (day !== null) {
          const isHoliday = args.nextPlanCalendar?.holidays.has(day)
          const isSunday = dayIndex === 0
          plan.addText(String(day), {
            x: x + px(16), y: rowY + px(6), w: px(40), h: px(18),
            fontFace: FONT_FACE, fontSize: 16.5, color: isSunday || isHoliday ? 'DC2626' : BODY_TEXT,
          })
        }
      })
      addPanel(plan, boardX + calendarW + gap, rowY, weeklyW - gap, bodyH, 'FFFFFF', PANEL_LINE)
    })
  }

  await pptx.writeFile({ fileName: `thekary-point-report-${args.reportMonthKey}-editable.pptx` })
}
