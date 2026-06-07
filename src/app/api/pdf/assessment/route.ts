import { NextRequest, NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType,
  convertInchesToTwip, Footer, PageNumber,
} from 'docx';

// Prevent Vercel/serverless from timing out the report generation
export const maxDuration = 60;

// Color constants
const PRIMARY_BLUE = '1E40AF';
const SECONDARY_BLUE = '3B82F6';
const DARK_GRAY = '333333';
const MEDIUM_GRAY = '666666';
const LIGHT_GRAY = 'F5F5F5';
const ORANGE = 'F97316';
const RED = 'EF4444';
const WARNING_BG = 'FFF8E1';
const WARNING_BORDER = 'FBBF24';

function getScoreLabel(percentage: number): string {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Satisfactory';
  return 'Needs Improvement';
}

function getScoreColorHex(percentage: number): string {
  if (percentage >= 80) return PRIMARY_BLUE;
  if (percentage >= 60) return SECONDARY_BLUE;
  if (percentage >= 40) return ORANGE;
  return RED;
}

// Paragraph border definitions (docx-js format)
const separatorBorder = {
  top: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY_BLUE, space: 1 },
};

const thinSeparatorBorder = {
  top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC', space: 1 },
};

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

    // Recalculate total from individual criterion scores
    const totalScore = scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
    const maxScore = scores.reduce((sum: number, s: any) => sum + (s.maxScore || 0), 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const overallFeedback = assessment.overallFeedback || '';
    const wordCount = assessment.wordCount || 0;
    const courseName = course?.name || 'Unknown Course';
    const courseCode = course?.code || 'N/A';
    const offTopicClassification = assessment.offTopicClassification || 'on-topic';
    const label = getScoreLabel(percentage);
    const labelColor = getScoreColorHex(percentage);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // ── Build document sections ──
    const children: (Paragraph | Table)[] = [];

    // ── HEADER ──
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Automated Writing Evaluation', bold: true, size: 44, color: PRIMARY_BLUE, font: 'Calibri' }),
      ],
    }));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'Assessment Report', size: 26, color: DARK_GRAY, font: 'Calibri' }),
      ],
    }));

    // Course info
    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `Course: ${courseName} (${courseCode})`, size: 20, color: DARK_GRAY, font: 'Calibri' }),
      ],
    }));

    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `Date: ${dateStr}`, size: 20, color: DARK_GRAY, font: 'Calibri' }),
      ],
    }));

    if (wordCount) {
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `Word Count: ${wordCount} words`, size: 20, color: DARK_GRAY, font: 'Calibri' }),
        ],
      }));
    }

    // Off-topic indicator
    if (offTopicClassification && offTopicClassification !== 'on-topic') {
      const offTopicLabel = offTopicClassification.includes('completely') ? 'COMPLETELY OFF-TOPIC' : 'PARTIALLY OFF-TOPIC';
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `⚠ ${offTopicLabel}`, bold: true, size: 22, color: RED, font: 'Calibri' }),
        ],
      }));
    }

    // Separator
    children.push(new Paragraph({ border: separatorBorder, spacing: { after: 300 } }));

    // ── SCORE SUMMARY TABLE ──
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Score Summary', bold: true, size: 30, color: PRIMARY_BLUE, font: 'Calibri' }),
      ],
    }));

    const summaryTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 }, children: [new TextRun({ text: `${totalScore}/${maxScore}`, bold: true, size: 36, color: PRIMARY_BLUE, font: 'Calibri' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Total Score', size: 18, color: MEDIUM_GRAY, font: 'Calibri' })] }),
              ],
            }),
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 }, children: [new TextRun({ text: `${percentage}%`, bold: true, size: 36, color: PRIMARY_BLUE, font: 'Calibri' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Percentage', size: 18, color: MEDIUM_GRAY, font: 'Calibri' })] }),
              ],
            }),
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: LIGHT_GRAY },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 }, children: [new TextRun({ text: label, bold: true, size: 28, color: labelColor, font: 'Calibri' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Performance', size: 18, color: MEDIUM_GRAY, font: 'Calibri' })] }),
              ],
            }),
          ],
        }),
      ],
    });

    children.push(summaryTable);

    // ── DETAILED CRITERIA ASSESSMENT ──
    children.push(new Paragraph({ spacing: { before: 300, after: 120 }, children: [
      new TextRun({ text: 'Detailed Criteria Assessment', bold: true, size: 30, color: PRIMARY_BLUE, font: 'Calibri' }),
    ]}));

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      const cName = score.criterionName || `Criterion ${i + 1}`;
      const cScore = score.score || 0;
      const cMax = score.maxScore || 6;
      const cPct = cMax > 0 ? Math.round((cScore / cMax) * 100) : 0;
      const cColor = getScoreColorHex(cPct);

      // Criterion header with score
      children.push(new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({ text: `${cName}  `, bold: true, size: 24, color: cColor, font: 'Calibri' }),
          new TextRun({ text: `(${cScore}/${cMax} — ${cPct}%)`, size: 22, color: cColor, font: 'Calibri' }),
        ],
      }));

      // Parse and render feedback sections
      const feedback = score.feedback || 'No feedback provided.';
      const feedbackLines = feedback.split('\n').filter((l: string) => l.trim());

      for (const line of feedbackLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for section headers
        if (trimmed.startsWith('Justification:')) {
          children.push(new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: 'Justification: ', bold: true, size: 18, color: DARK_GRAY, font: 'Calibri' }),
              new TextRun({ text: trimmed.replace('Justification:', '').trim(), size: 18, color: DARK_GRAY, font: 'Calibri' }),
            ],
          }));
        } else if (trimmed.startsWith('Strengths:')) {
          children.push(new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: 'Strengths: ', bold: true, size: 18, color: '16A34A', font: 'Calibri' }),
              new TextRun({ text: trimmed.replace('Strengths:', '').trim(), size: 18, color: DARK_GRAY, font: 'Calibri' }),
            ],
          }));
        } else if (trimmed.startsWith('Mistakes:')) {
          children.push(new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: 'Mistakes: ', bold: true, size: 18, color: RED, font: 'Calibri' }),
              new TextRun({ text: trimmed.replace('Mistakes:', '').trim(), size: 18, color: DARK_GRAY, font: 'Calibri' }),
            ],
          }));
        } else if (trimmed.startsWith('Suggestions:')) {
          children.push(new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: 'Suggestions: ', bold: true, size: 18, color: SECONDARY_BLUE, font: 'Calibri' }),
              new TextRun({ text: trimmed.replace('Suggestions:', '').trim(), size: 18, color: DARK_GRAY, font: 'Calibri' }),
            ],
          }));
        } else {
          children.push(new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: trimmed, size: 18, color: DARK_GRAY, font: 'Calibri' }),
            ],
          }));
        }
      }
    }

    // ── OVERALL FEEDBACK ──
    children.push(new Paragraph({ border: thinSeparatorBorder, spacing: { before: 300, after: 200 } }));

    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Overall Feedback', bold: true, size: 30, color: PRIMARY_BLUE, font: 'Calibri' }),
      ],
    }));

    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: overallFeedback, size: 20, color: DARK_GRAY, font: 'Calibri' }),
      ],
    }));

    // ── SUBMITTED ESSAY ──
    if (essayText && essayText.trim()) {
      children.push(new Paragraph({ border: thinSeparatorBorder, spacing: { before: 200, after: 200 } }));

      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'Submitted Essay', bold: true, size: 30, color: PRIMARY_BLUE, font: 'Calibri' }),
        ],
      }));

      const essayWordCount = essayText.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `Word Count: ${essayWordCount} words`, size: 18, color: MEDIUM_GRAY, font: 'Calibri' }),
        ],
      }));

      const displayText = essayText.length > 3000 ? essayText.substring(0, 3000) + '...' : essayText;
      children.push(new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: displayText, size: 18, color: DARK_GRAY, font: 'Calibri' }),
        ],
      }));
    }

    // ── AI DISCLAIMER ──
    children.push(new Paragraph({ border: thinSeparatorBorder, spacing: { before: 200, after: 200 } }));

    const disclaimerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: WARNING_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: WARNING_BORDER },
        left: { style: BorderStyle.SINGLE, size: 1, color: WARNING_BORDER },
        right: { style: BorderStyle.SINGLE, size: 1, color: WARNING_BORDER },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: WARNING_BG },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 80 },
                  children: [
                    new TextRun({ text: '⚠ ', bold: true, size: 16, color: 'F59E0B', font: 'Calibri' }),
                    new TextRun({ text: 'This assessment was generated by artificial intelligence and may contain inaccuracies or inconsistencies. Scores and feedback should be reviewed by a qualified instructor before being used for grading or placement decisions.', size: 16, color: '92400E', font: 'Calibri' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    children.push(disclaimerTable);

    // ── FOOTER CREDENTIALS ──
    children.push(new Paragraph({ border: thinSeparatorBorder, spacing: { before: 200, after: 100 } }));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: 'AWE System — Automated Writing Evaluation Platform', size: 14, color: '999999', font: 'Calibri' }),
      ],
    }));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: 'Sultan Qaboos University — Center for Preparatory Studies', size: 14, color: '999999', font: 'Calibri' }),
      ],
    }));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: 'AI Co-Marker Assistance Project, 2026', size: 14, color: '999999', font: 'Calibri' }),
      ],
    }));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({ text: 'Developed by: Dr. Waleed Mandour | Powered by Google Gemini AI | This report is auto-generated for educational assessment purposes only.', size: 12, color: 'BBBBBB', font: 'Calibri' }),
      ],
    }));

    // ── Build DOCX ──
    const doc = new Document({
      creator: 'AWE System - Sultan Qaboos University',
      title: `AWE Assessment Report - ${courseCode}`,
      description: 'Essay Assessment Report',
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.7),
              right: convertInchesToTwip(0.7),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', size: 14, color: '999999', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '999999', font: 'Calibri' }),
                ],
              }),
            ],
          }),
        },
        children,
      }],
    });

    const docxBuffer = await Packer.toBuffer(doc);

    // ── Return DOCX as downloadable response ──
    const dateFileStr = new Date().toISOString().split('T')[0];
    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="AWE_Assessment_${courseCode}_${dateFileStr}.docx"`,
        'Content-Length': String(docxBuffer.length),
      },
    });
  } catch (error) {
    console.error('DOCX generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate DOCX',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
