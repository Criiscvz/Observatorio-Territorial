import { ChartFilter } from './univariable-request.interface';

export interface TextAnalysisRequest {
  dataset_id: string;
  variable_id: string;
  limit?: number;
  filters?: ChartFilter[];
}

export interface SentimentDistribution {
  positive: number;
  negative: number;
  neutral: number;
}

export interface SentimentData {
  overall: 'positive' | 'negative' | 'neutral';
  score: number;
  distribution: SentimentDistribution;
  total: number;
}

export interface NgramItem {
  phrase: string;
  count: number;
}

export interface TextAnalysisResponse {
  variable_id: string;
  nombre_variable: string;
  tipo_variable: string;

  wordcloud: {
    words: Array<{ name: string; value: number; weight: number }>;
    labels: string[];
    values: number[];
  };

  sentiment: SentimentData;

  keywords: {
    labels: string[];
    values: number[];
    unclassified: number;
  };

  ngrams: {
    bigrams: NgramItem[];
    trigrams: NgramItem[];
  };

  stats: {
    total_texts: number;
    unique_words: number;
    total_words: number;
    avg_text_length: number;
    bigrams_found: number;
    trigrams_found: number;
  };
}
