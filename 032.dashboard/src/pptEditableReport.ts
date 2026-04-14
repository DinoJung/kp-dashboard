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
const cm = (value: number) => Number((value / 2.54).toFixed(4))
const PANEL_LINE = 'E5E7EB'
const TABLE_BORDER = 'BFBFBF'
const PALE_GRAY = 'F8FAFC'
const BODY_TEXT = '111827'
const MUTED_TEXT = '6B7280'
const ACCENT_AMBER = 'F59E0B'
const LIGHT_AMBER = 'FEF3C7'
const HEADER_NEUTRAL_FILL = 'F3F4F6'
const HEADER_GOLD_FILL = 'FFF2CC'
const TOTAL_ROW_FILL = 'D6DCE5'
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
  pptx.theme = { headFontFace: FONT_FACE, bodyFontFace: FONT_FACE, lang: 'ko-KR' } as any

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
      x: px(96), y: px(84), w: px(470), h: px(20),
      fontFace: FONT_FACE, fontSize: 10, bold: true, color: ACCENT_AMBER,
    })
    slide.addText(title, {
      x: px(96), y: px(108), w: px(1000), h: px(42),
      fontFace: FONT_FACE, fontSize: 20, bold: true, color: BODY_TEXT,
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
        y: px(164),
        w: width,
        h: px(44),
        margin: 0,
        fontFace: FONT_FACE,
        fontSize: 9,
        bold: true,
        align: 'center',
        valign: 'middle',
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
      x: x + px(16), y: y + px(16), w: w - px(28), h: px(18),
      fontFace: FONT_FACE, fontSize: compact ? 8.5 : 9, bold: true, color: BODY_TEXT,
    })
    const valueY = y + px(compact ? 42 : 44)
    const deltaY = valueY + px(24) + cm(0.25)
    const helperY = deltaY + px(14) + cm(0.15)
    slide.addText(card.value, {
      x: x + px(16), y: valueY, w: w - px(28), h: px(24),
      fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
      align: compact ? 'right' : 'left',
    })
    if (card.delta) {
      slide.addText(card.delta, {
        x: x + px(16), y: deltaY, w: w - px(28), h: px(14),
        fontFace: FONT_FACE, fontSize: 8, bold: true, color: BODY_TEXT,
      })
    }
    if (card.helper) {
      slide.addText(card.helper, {
        x: x + px(16), y: helperY, w: w - px(28), h: px(14),
        fontFace: FONT_FACE, fontSize: 7, color: MUTED_TEXT,
      })
    }
  }

  function addPanelTitle(slide: PptxGenJS.Slide, eyebrow: string, title: string, x: number, y: number, w: number, eyebrowSize = 8, titleSize = 14) {
    if (eyebrow) {
      slide.addText(eyebrow, { x, y, w: w + px(24), h: px(16), fontFace: FONT_FACE, fontSize: eyebrowSize, bold: true, color: ACCENT_AMBER })
    }
    slide.addText(title, { x, y: y + px(18), w: w + px(24), h: px(24), fontFace: FONT_FACE, fontSize: titleSize, bold: true, color: BODY_TEXT })
  }

  function makeTableRows(
    rows: TableRows,
    options?: {
      headerFill?: string
      firstColumnFill?: string
      secondPlusHeaderFill?: string
      totalRowFill?: string
      secondRowFill?: string
    },
  ): any {
    return rows.map((row, rowIndex) => {
      const isHeader = rowIndex === 0
      const isTotalRow = row[0] === 'Total'
      return row.map((text, colIndex) => {
        const resolved: any = { align: 'center', valign: 'middle' }

        if (isHeader) {
          resolved.bold = true
          if (colIndex === 0 && options?.firstColumnFill) {
            resolved.fill = { color: options.firstColumnFill }
          } else if (colIndex > 0 && options?.secondPlusHeaderFill) {
            resolved.fill = { color: options.secondPlusHeaderFill }
          } else if (options?.headerFill) {
            resolved.fill = { color: options.headerFill }
          }
        } else if (rowIndex === 1 && options?.secondRowFill) {
          resolved.fill = { color: options.secondRowFill }
        } else if (isTotalRow && options?.totalRowFill) {
          resolved.bold = true
          resolved.fill = { color: options.totalRowFill }
        } else if (colIndex === 0 && options?.firstColumnFill) {
          resolved.fill = { color: options.firstColumnFill }
        }

        return { text, options: resolved }
      })
    }) as any
  }

  async function addMatchedHeightImages(slide: PptxGenJS.Slide, sources: string[], boxX: number, boxY: number, boxW: number, boxH: number, gap: number, fixedHeight: number) {
    const validSources = sources.filter(Boolean).slice(0, 2)
    if (!validSources.length) return

    const sizes = await Promise.all(validSources.map((src) => getImageSize(src)))
    const drawH = Math.min(fixedHeight, boxH)
    const widths = sizes.map((size) => drawH * (size.width / size.height))
    const totalGap = gap * Math.max(0, validSources.length - 1)
    const totalWidth = widths.reduce((sum, value) => sum + value, 0) + totalGap
    let cursorX = boxX + Math.max(0, (boxW - totalWidth) / 2)
    const y = boxY + Math.max(0, (boxH - drawH) / 2)

    for (const [index, src] of validSources.entries()) {
      const data = await toDataUrl(src)
      const drawW = widths[index]
      slide.addImage({ data, x: cursorX, y, w: drawW, h: drawH })
      cursorX += drawW + gap
    }
  }

  const logoData = await toDataUrl(args.logoSrc)

  const cover = pptx.addSlide()
  cover.background = { color: 'FFFFFF' }
  const coverGroupTop = px(394)
  const coverTitleH = px(36)
  const coverGap1 = px(74)
  const coverMainH = px(60)
  const coverGap2 = px(70)
  const coverMetaH = px(22)
  const coverGap3 = px(8)
  cover.addText('THEKARY POINT REPORT', {
    x: px(520), y: coverGroupTop, w: px(880), h: coverTitleH, fontFace: FONT_FACE, fontSize: 32, bold: true, align: 'center', color: MUTED_TEXT,
  })
  cover.addText([
    { text: '더캐리포인트 ', options: { color: '9CA3AF' } },
    { text: args.coverTitle, options: { color: ACCENT_AMBER } },
  ], {
    x: px(420), y: coverGroupTop + coverTitleH + coverGap1, w: px(1080), h: coverMainH, margin: 0, fontFace: FONT_FACE, fontSize: 32, bold: true, align: 'center', valign: 'middle',
  })
  cover.addText('마케팅 2팀', { x: px(760), y: coverGroupTop + coverTitleH + coverGap1 + coverMainH + coverGap2, w: px(400), h: coverMetaH, fontFace: FONT_FACE, fontSize: 12, align: 'center', color: MUTED_TEXT })
  cover.addText(args.monthEndLabel, { x: px(760), y: coverGroupTop + coverTitleH + coverGap1 + coverMainH + coverGap2 + coverMetaH + coverGap3, w: px(400), h: coverMetaH, fontFace: FONT_FACE, fontSize: 12, align: 'center', color: MUTED_TEXT })
  cover.addImage({ data: logoData, x: px(862), y: px(911.6), w: px(196), h: px(50.4) })

  const result = pptx.addSlide()
  result.background = { color: 'FFFFFF' }
  addHeader(result, `${args.monthLabelKorean} RESULT`, 'summary', logoData)
  const metricGap = px(16)
  const metricW = px((1728 - 16 * 6) / 7)
  args.resultMetricCards.forEach((card, index) => {
    addMetricCard(result, card, px(96) + index * (metricW + metricGap), px(228), metricW, px(138))
  })
  const summaryX = px(96)
  const panelsY = px(378)
  const summaryW = px(982)
  const promotionX = summaryX + summaryW + px(24)
  const promotionW = px(722)
  const topPanelH = cm(7.46)
  const analysisGap = cm(0.25)
  const analysisY = panelsY + topPanelH + analysisGap
  const analysisH = cm(3.63)
  addPanel(result, summaryX, panelsY, summaryW, topPanelH)
  result.addText('최근 6개월 핵심 지표 추이', {
    x: summaryX + px(26), y: panelsY + px(34), w: summaryW - px(28), h: px(24), fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
  })
  const summaryTableW = summaryW - px(28)
  const summarySpecifiedColW = [cm(1.85), cm(1.85), cm(1.85), cm(2.5), cm(2.5), cm(1.85), cm(1.85)]
  const summaryMonthColW = Number((summaryTableW - summarySpecifiedColW.reduce((sum, value) => sum + value, 0)).toFixed(4))
  result.addTable(makeTableRows(args.sixMonthTableRows, { headerFill: HEADER_NEUTRAL_FILL, secondRowFill: HEADER_GOLD_FILL }), {
    x: summaryX + px(14), y: panelsY + px(66), w: summaryTableW, h: topPanelH - px(80),
    colW: [summaryMonthColW, ...summarySpecifiedColW],
    fontFace: FONT_FACE, fontSize: 8, color: BODY_TEXT, border: { color: TABLE_BORDER, pt: 1 },
    fill: { color: 'FFFFFF' }, margin: 0.03, rowH: px(48), autoFit: false, align: 'center', valign: 'middle',
  } as any)
  addPanel(result, promotionX, panelsY, promotionW, topPanelH)
  result.addText('프로모션', {
    x: promotionX + px(18), y: panelsY + px(16), w: promotionW - px(24), h: px(16), fontFace: FONT_FACE, fontSize: 7, bold: true, color: ACCENT_AMBER,
  })
  result.addText('포인트현황', {
    x: promotionX + px(18), y: panelsY + px(34), w: promotionW - px(24), h: px(24), fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
  })
  result.addTable(makeTableRows(args.promotionRows, { headerFill: HEADER_NEUTRAL_FILL, totalRowFill: TOTAL_ROW_FILL }), {
    x: promotionX + px(10), y: panelsY + px(64), w: promotionW - px(20), h: topPanelH - px(74),
    colW: [cm(2.35), cm(1.65), cm(2.12), cm(2.12), cm(2.12), cm(1.65)],
    fontFace: FONT_FACE, fontSize: 8, color: BODY_TEXT, border: { color: TABLE_BORDER, pt: 1 },
    fill: { color: 'FFFFFF' }, margin: 0.015, rowH: px(39), autoFit: false, align: 'center', valign: 'middle',
  } as any)
  addPanel(result, px(96), analysisY, px(1728), analysisH)
  result.addText('결과분석', {
    x: px(122), y: analysisY + px(22), w: px(320), h: px(24), fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
  })

  const exposure = pptx.addSlide()
  exposure.background = { color: 'FFFFFF' }
  addHeader(exposure, `${args.monthLabelKorean} 브랜드 사이트 팝업`, 'exposure', logoData)
  exposure.addText(`더캐리포인트 가입 유도 팝업 | ${args.exposureFirstBusinessDay} 10:00`, {
    x: px(96), y: px(228), w: px(1560), h: px(28), fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
  })
  exposure.addText('이벤트페이지(KP), 브랜드 홈페이지 메인홈(BP, BPU, IB, PK), 마이페이지(KR)', {
    x: px(96), y: px(266), w: px(1580), h: px(22), fontFace: FONT_FACE, fontSize: 10, color: '4B5563',
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
  addPanelTitle(ad, '광고상세', 'META 캠페인 성과', px(122), px(350), px(400), 7, 12)
  ad.addTable(makeTableRows(args.campaignRows, { headerFill: HEADER_NEUTRAL_FILL, totalRowFill: TOTAL_ROW_FILL }), {
    x: px(114), y: px(400), w: px(1692), h: px(218),
    fontFace: FONT_FACE, fontSize: 8, color: BODY_TEXT, border: { color: TABLE_BORDER, pt: 1 },
    fill: { color: 'FFFFFF' }, margin: 0.03, rowH: px(44), autoFit: false, align: 'center', valign: 'middle',
  } as any)
  const galleryW = px((1728 - 16) / 2)
  for (const [index, card] of args.adSourceCards.entries()) {
    const panelX = px(96) + index * (galleryW + px(16))
    addPanel(ad, panelX, px(660), galleryW, px(300))
    ad.addText('AD SOURCE', {
      x: panelX + px(24), y: px(684), w: px(154), h: px(16), fontFace: FONT_FACE, fontSize: 7, bold: true, color: ACCENT_AMBER,
    })
    ad.addText(card.label, {
      x: panelX + px(24), y: px(706), w: px(154), h: px(24), fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
    })
    const imageBoxX = panelX + px(150)
    const imageBoxY = px(676)
    const imageBoxW = galleryW - px(174)
    const imageBoxH = px(268)
    addPanel(ad, imageBoxX, imageBoxY, imageBoxW, imageBoxH, PALE_GRAY, 'F1F5F9')
    await addMatchedHeightImages(ad, card.images, imageBoxX, imageBoxY, imageBoxW, imageBoxH, cm(0.3), cm(4.35))
  }

  const plan = pptx.addSlide()
  plan.background = { color: 'FFFFFF' }
  const planGap = px(12)
  const planHeaderH = px(44)
  const planBodyH = cm(1.8)
  const planWeeks = args.nextPlanCalendar ? args.nextPlanCalendar.weeks.length : 5
  const planPanelH = args.nextPlanCalendar
    ? (px(318) - px(228)) + planHeaderH + planGap + planWeeks * planBodyH + (planWeeks - 1) * planGap + px(24)
    : px(724)
  addHeader(plan, `${args.monthLabelKorean} NEXT PLAN`, 'next-plan', logoData)
  addPanel(plan, px(96), px(228), px(1728), planPanelH)
  plan.addText('다음달 일정', {
    x: px(122), y: px(250), w: px(680), h: px(16), fontFace: FONT_FACE, fontSize: 7, bold: true, color: ACCENT_AMBER,
  })
  plan.addText(args.nextPlanCalendar ? `${args.nextPlanCalendar.monthLabel} 캘린더` : '캘린더 준비 중', {
    x: px(122), y: px(268), w: px(720), h: px(24), fontFace: FONT_FACE, fontSize: 12, bold: true, color: BODY_TEXT,
  })
  if (args.nextPlanCalendar) {
    const boardX = px(122)
    const boardY = px(318)
    const totalW = px(1676)
    const gap = planGap
    const calendarW = totalW * 0.6
    const weeklyW = totalW * 0.4
    const dayCellW = (calendarW - gap * 6) / 7
    const headerH = planHeaderH
    const bodyH = planBodyH
    args.calendarWeekdays.forEach((weekday, index) => {
      const x = boardX + index * (dayCellW + gap)
      addPanel(plan, x, boardY, dayCellW, headerH, PALE_GRAY, PALE_GRAY)
      plan.addText(weekday, {
        x: x - px(4), y: boardY + px(10), w: dayCellW + px(8), h: px(18),
        fontFace: FONT_FACE, fontSize: 8.5, bold: true, align: 'center', color: index === 0 ? 'DC2626' : MUTED_TEXT,
      })
    })
    addPanel(plan, boardX + calendarW + gap, boardY, weeklyW - gap, headerH, PALE_GRAY, PALE_GRAY)
    plan.addText('주요일정', {
      x: boardX + calendarW + gap - px(4), y: boardY + px(10), w: weeklyW - gap + px(8), h: px(18),
      fontFace: FONT_FACE, fontSize: 8.5, bold: true, align: 'center', color: BODY_TEXT,
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
            x: x + px(10), y: rowY + px(8), w: px(64), h: px(18),
            fontFace: FONT_FACE, fontSize: 10, color: isSunday || isHoliday ? 'DC2626' : BODY_TEXT,
          })
        }
      })
      addPanel(plan, boardX + calendarW + gap, rowY, weeklyW - gap, bodyH, 'FFFFFF', PANEL_LINE)
    })
  }

  const fileName = `thekary-point-report-${args.reportMonthKey}-editable.pptx`
  await pptx.writeFile({ fileName })
}
