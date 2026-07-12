/**
 * The branch's 2025 tajweed rubric, transcribed from
 * «معايير التقييم — المسابقة المحلية 2025» (إعداد: حمدي الشوك).
 *
 * Each criterion scores differently by category band: «الأصناف دون 30 حزبًا» and
 * «30 حزبًا فما فوق». Every scale carries the descriptive bands the judge reads
 * before choosing a number. These are the seeded defaults; an admin edits them,
 * adds scales/bands, or changes the maxima from إعدادات التقييم.
 */

export interface BandSeed {
  minPoints: number;
  maxPoints: number;
  descriptionAr: string;
}

export interface ScaleSeed {
  labelAr: string;
  minHizb: number;
  maxHizb: number;
  maxPoints: number;
  bands: BandSeed[];
}

export interface TajweedCriterionSeed {
  key: string;
  labelAr: string;
  descriptionAr: string;
  /** Fallback ceiling when no scale matches; the larger of the two scales. */
  maxPoints: number;
  scales: ScaleSeed[];
}

const UNDER_30 = { labelAr: "دون 30 حزبًا", minHizb: 1, maxHizb: 29 } as const;
const OVER_30 = { labelAr: "30 حزبًا فما فوق", minHizb: 30, maxHizb: 60 } as const;

export const TAJWEED_CRITERIA: TajweedCriterionSeed[] = [
  {
    key: "ghunna_mudood",
    labelAr: "الغنن والمدود",
    descriptionAr: "أحكام الغنّة والمدود ومراعاة الأزمنة.",
    maxPoints: 10,
    scales: [
      {
        ...UNDER_30,
        maxPoints: 10,
        bands: [
          { minPoints: 0, maxPoints: 2, descriptionAr: "تلاوة الطالب لا تراعي قواعد الغنن والمدود" },
          { minPoints: 2, maxPoints: 5, descriptionAr: "تلاوة الطالب تضمّنت إسقاطًا متكرّرًا للغنن أو للمدود" },
          { minPoints: 5, maxPoints: 8, descriptionAr: "إتيان الطالب على جميع الأحكام (غنن أو مدود) مع وجود خلل في الأزمنة" },
          { minPoints: 8, maxPoints: 10, descriptionAr: "إتيان الطالب على جميع مواضع الغنن والمدود مع احترام الأزمنة" },
        ],
      },
      {
        ...OVER_30,
        maxPoints: 8,
        bands: [
          { minPoints: 0, maxPoints: 2, descriptionAr: "تلاوة الطالب لا تراعي قواعد الغنن والمدود" },
          { minPoints: 2, maxPoints: 4, descriptionAr: "تلاوة الطالب تضمّنت إسقاطًا متكرّرًا للغنن أو للمدود" },
          { minPoints: 4, maxPoints: 6, descriptionAr: "إتيان الطالب على جميع الأحكام مع وجود خلل في الأزمنة" },
          { minPoints: 6, maxPoints: 8, descriptionAr: "إتيان الطالب على جميع مواضع الغنن والمدود مع احترام الأزمنة" },
        ],
      },
    ],
  },
  {
    key: "makharij_sifat",
    labelAr: "المخارج والصفات",
    descriptionAr: "مخارج الحروف وصفاتها.",
    maxPoints: 16,
    scales: [
      {
        ...UNDER_30,
        maxPoints: 16,
        bands: [
          { minPoints: 0, maxPoints: 4, descriptionAr: "تلاوة الطالب لا تراعي قواعد التجويد" },
          { minPoints: 4, maxPoints: 6, descriptionAr: "تلاوة الطالب تضمّنت إسقاطًا لعدّة صفات أو أخطاء في مخارج الحروف" },
          { minPoints: 6, maxPoints: 12, descriptionAr: "يُشترط أن تكون غالبية المخارج صحيحة" },
          { minPoints: 12, maxPoints: 16, descriptionAr: "تلاوة خالية من التعسّف مع تخليص الحركات" },
        ],
      },
      {
        ...OVER_30,
        maxPoints: 10,
        bands: [
          { minPoints: 0, maxPoints: 2, descriptionAr: "تلاوة الطالب لا تراعي قواعد التجويد" },
          { minPoints: 2, maxPoints: 5, descriptionAr: "تلاوة الطالب تضمّنت إسقاطًا لعدّة صفات أو أخطاء في مخارج الحروف" },
          { minPoints: 5, maxPoints: 8, descriptionAr: "يُشترط أن تكون غالبية المخارج صحيحة" },
          { minPoints: 8, maxPoints: 10, descriptionAr: "تلاوة خالية من التعسّف مع تخليص الحركات" },
        ],
      },
    ],
  },
  {
    key: "waqf_ibtidaa",
    labelAr: "الوقف والابتداء",
    descriptionAr: "حسن الوقف والابتداء وتصوير المعنى.",
    maxPoints: 5,
    scales: [
      {
        ...UNDER_30,
        maxPoints: 5,
        bands: [
          { minPoints: 0, maxPoints: 2, descriptionAr: "عدم انتباه الطالب للأوقاف، أي يتوقّف أين ينحبس نفسه" },
          { minPoints: 2, maxPoints: 4, descriptionAr: "التزام الطالب بتتبّع أوقاف المصحف وحرصه على عدم التوقّف عند انقطاع النفس" },
          { minPoints: 4, maxPoints: 5, descriptionAr: "تصوير المعنى القرآني وحسن اختيار الأوقاف والاستدلالات" },
        ],
      },
      {
        ...OVER_30,
        maxPoints: 3,
        bands: [
          { minPoints: 0, maxPoints: 1, descriptionAr: "عدم انتباه الطالب للأوقاف، أي يتوقّف أين ينحبس نفسه" },
          { minPoints: 1, maxPoints: 2, descriptionAr: "التزام الطالب بتتبّع أوقاف المصحف ويتحرّى أوقافه وفق تنفّسه" },
          { minPoints: 2, maxPoints: 3, descriptionAr: "تصوير المعنى القرآني وحسن اختيار الأوقاف والاستدلالات" },
        ],
      },
    ],
  },
  {
    key: "husn_adaa",
    labelAr: "حسن الأداء",
    descriptionAr: "تناسق التلاوة وعذوبة الصوت.",
    maxPoints: 5,
    scales: [
      {
        labelAr: "جميع الأصناف",
        minHizb: 1,
        maxHizb: 60,
        maxPoints: 5,
        bands: [
          { minPoints: 0, maxPoints: 2, descriptionAr: "تلاوة غير متناسقة" },
          { minPoints: 2, maxPoints: 4, descriptionAr: "تلاوة متّزنة" },
          { minPoints: 4, maxPoints: 5, descriptionAr: "عذوبة في الصوت" },
        ],
      },
    ],
  },
];
