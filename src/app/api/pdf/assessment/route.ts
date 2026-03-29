import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

// Prevent Vercel/serverless from timing out the PDF generation
export const maxDuration = 60;

// Color constants
const PRIMARY_GREEN = '#1a5f2a';
const SECONDARY_GREEN = '#2a7f3a';
const GOLD = '#c9a227';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#333333';

function getScoreLabel(percentage: number): string {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Satisfactory';
  return 'Needs Improvement';
}

function getScoreColor(percentage: number): string {
  if (percentage >= 80) return PRIMARY_GREEN;
  if (percentage >= 60) return GOLD;
  if (percentage >= 40) return '#f97316';
  return '#ef4444';
}

function safeText(doc: any, text: string, x: number, y: number, options: any = {}) {
  // Safely render text — handles newlines within pdfkit
  const opts = { width: options.width || 440, lineGap: options.lineGap || 3, ...options };
  doc.text(text, x, y, opts);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assessment, course, essayText } = body;

    if (!assessment) {
      return NextResponse.json(
        { error: 'No assessment data provided' },
        { status: 400 }
      );
    }

    const scores: any[] = assessment.scores || [];
    const totalScore = assessment.totalScore || 0;
    const maxScore = assessment.maxScore || 24;
    const percentage = assessment.percentage || 0;
    const overallFeedback = assessment.overallFeedback || '';
    const wordCount = assessment.wordCount || 0;
    const courseName = course?.name || 'Unknown Course';
    const courseCode = course?.code || 'N/A';

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `AWE Assessment Report - ${courseCode}`,
        Author: 'AWE System - Sultan Qaboos University',
        Subject: 'Essay Assessment Report',
      }
    });

    // Pipe to a PassThrough stream so we can collect the bytes
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.pipe(stream);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ==================== HEADER ====================
    doc.fontSize(22).fillColor(PRIMARY_GREEN)
      .text('Automated Writing Evaluation', { align: 'center' });

    doc.fontSize(13).fillColor(DARK_GRAY)
      .text('Assessment Report', { align: 'center' });

    doc.moveDown(0.5);

    // Course info
    doc.fontSize(10).fillColor(DARK_GRAY);
    doc.text(`Course: ${courseName} (${courseCode})`);
    doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    if (wordCount) doc.text(`Word Count: ${wordCount} words`);

    doc.moveDown(0.8);

    // Divider line
    doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y)
      .strokeColor(PRIMARY_GREEN).lineWidth(2).stroke();

    doc.moveDown(0.8);

    // ==================== SCORE SUMMARY ====================
    doc.fontSize(15).fillColor(PRIMARY_GREEN).text('Score Summary');
    doc.moveDown(0.4);

    // Score summary box
    const boxY = doc.y;
    const boxHeight = 55;
    doc.roundedRect(doc.x, boxY, pageWidth, boxHeight, 5)
      .fillAndStroke(LIGHT_GRAY, '#dddddd');

    // Total Score
    doc.fillColor(PRIMARY_GREEN).fontSize(18)
      .text(`${totalScore}/${maxScore}`, doc.x + 30, boxY + 16, { width: 120, align: 'center' });
    doc.fontSize(9).fillColor('#666666')
      .text('Total Score', doc.x + 30, boxY + 38, { width: 120, align: 'center' });

    // Vertical separator
    doc.moveTo(doc.x + 160, boxY + 10).lineTo(doc.x + 160, boxY + boxHeight - 10)
      .strokeColor('#cccccc').lineWidth(1).stroke();

    // Percentage
    doc.fillColor(PRIMARY_GREEN).fontSize(18)
      .text(`${percentage}%`, doc.x + 170, boxY + 16, { width: 120, align: 'center' });
    doc.fontSize(9).fillColor('#666666')
      .text('Percentage', doc.x + 170, boxY + 38, { width: 120, align: 'center' });

    // Vertical separator
    doc.moveTo(doc.x + 300, boxY + 10).lineTo(doc.x + 300, boxY + boxHeight - 10)
      .strokeColor('#cccccc').lineWidth(1).stroke();

    // Performance label
    const label = getScoreLabel(percentage);
    const labelColor = getScoreColor(percentage);
    doc.fillColor(labelColor).fontSize(14)
      .text(label, doc.x + 310, boxY + 20, { width: 130, align: 'center' });
    doc.fontSize(9).fillColor('#666666')
      .text('Performance', doc.x + 310, boxY + 38, { width: 130, align: 'center' });

    doc.y = boxY + boxHeight + 15;

    // ==================== CRITERIA BREAKDOWN ====================
    doc.fontSize(15).fillColor(PRIMARY_GREEN).text('Detailed Criteria Assessment');
    doc.moveDown(0.4);

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      const cName = score.criterionName || `Criterion ${i + 1}`;
      const cScore = Math.round(score.score || 0);
      const cMax = Math.round(score.maxScore || 6);
      const cPct = cMax > 0 ? Math.round((cScore / cMax) * 100) : 0;
      const cColor = getScoreColor(cPct);

      // Check if we need a new page
      if (doc.y > 600) {
        doc.addPage();
      }

      // Criterion header
      doc.fontSize(12).fillColor(cColor)
        .text(`${cName}`, { continued: true })
        .fontSize(10).fillColor('#666666')
        .text(`  (${cScore}/${cMax} — ${cPct}%)`);

      doc.moveDown(0.2);

      // Progress bar
      const barWidth = pageWidth;
      const filledWidth = barWidth * (cPct / 100);
      doc.roundedRect(doc.x, doc.y, barWidth, 6, 3).fillAndStroke('#eeeeee', '#eeeeee');
      if (filledWidth > 0) {
        doc.roundedRect(doc.x, doc.y, Math.max(filledWidth, 6), 6, 3).fill(cColor);
      }
      doc.y += 12;
      doc.moveDown(0.3);

      // Feedback — render the structured feedback string
      const feedback = score.feedback || 'No feedback provided.';
      doc.fontSize(9).fillColor(DARK_GRAY);
      safeText(doc, feedback, doc.x, doc.y, { width: pageWidth, lineGap: 2 });
      doc.moveDown(0.5);
    }

    // ==================== OVERALL FEEDBACK ====================
    if (doc.y > 550) doc.addPage();

    doc.moveDown(0.3);
    doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y)
      .strokeColor(GOLD).lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fontSize(15).fillColor(PRIMARY_GREEN).text('Overall Feedback');
    doc.moveDown(0.3);

    doc.fontSize(10).fillColor(DARK_GRAY);
    safeText(doc, overallFeedback, doc.x, doc.y, { width: pageWidth, lineGap: 3 });

    // ==================== ESSAY TEXT ====================
    if (essayText && essayText.trim()) {
      if (doc.y > 500) doc.addPage();

      doc.moveDown(0.5);
      doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y)
        .strokeColor(GOLD).lineWidth(1).stroke();
      doc.moveDown(0.5);

      doc.fontSize(15).fillColor(PRIMARY_GREEN).text('Submitted Essay');
      doc.moveDown(0.3);

      doc.fontSize(9).fillColor('#666666')
        .text(`Word Count: ${essayText.trim().split(/\s+/).length} words`);
      doc.moveDown(0.3);

      const displayText = essayText.length > 3000 ? essayText.substring(0, 3000) + '...' : essayText;
      doc.fontSize(9).fillColor(DARK_GRAY);
      safeText(doc, displayText, doc.x, doc.y, { width: pageWidth, lineGap: 2 });
    }

    // ==================== CREDENTIALS FOOTER ====================
    if (doc.y > 680) doc.addPage();

    doc.moveDown(1.5);
    doc.moveTo(doc.x, doc.y).lineTo(doc.x + pageWidth, doc.y)
      .strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveDown(0.5);

    doc.fontSize(7).fillColor('#999999');
    doc.text(
      'AWE System — Automated Writing Evaluation Platform',
      { align: 'center' }
    );
    doc.text(
      'Sultan Qaboos University — Center for Preparatory Studies',
      { align: 'center' }
    );
    doc.text(
      'AI Co-Marker Assistance Project, 2026',
      { align: 'center' }
    );
    doc.moveDown(0.2);
    doc.fontSize(6).fillColor('#bbbbbb');
    doc.text(
      'Developed by: Dr. Waleed Mandour | Powered by Google Gemini AI | This report is auto-generated for educational assessment purposes only.',
      { align: 'center' }
    );

    // Finalize PDF
    doc.end();

    // Wait for all chunks to be collected
    const pdfBytes = await new Promise<Buffer>((resolve) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Return PDF as downloadable response
    const dateStr = new Date().toISOString().split('T')[0];
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AWE_Assessment_${courseCode}_${dateStr}.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
