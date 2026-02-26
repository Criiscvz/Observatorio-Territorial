<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

/**
 * Pure PHP text processing pipeline for NLP tasks.
 * Handles tokenization, stemming, n-grams, TF-IDF, and sentiment analysis.
 * No external dependencies required.
 */
class TextProcessingService
{
    private array $stopwords;
    private int $minWordLength;
    private array $sentimentLexicon;

    public function __construct()
    {
        $config = config('nlp');
        $this->minWordLength = $config['min_word_length'] ?? 3;

        // Merge all language stopwords into one lookup
        $allStopwords = [];
        foreach (($config['stopwords'] ?? []) as $words) {
            foreach ($words as $word) {
                $allStopwords[$word] = true;
            }
        }
        $this->stopwords = $allStopwords;

        // Build sentiment lexicon
        $this->sentimentLexicon = [
            'positive' => [],
            'negative' => [],
        ];
        foreach (($config['sentiment']['positive'] ?? []) as $words) {
            foreach ($words as $word) {
                $this->sentimentLexicon['positive'][$word] = true;
            }
        }
        foreach (($config['sentiment']['negative'] ?? []) as $words) {
            foreach ($words as $word) {
                $this->sentimentLexicon['negative'][$word] = true;
            }
        }
    }

    /**
     * Normalize text: lowercase, remove punctuation, collapse whitespace.
     */
    public function normalize(string $text): string
    {
        $text = mb_strtolower(trim($text));
        $text = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $text);
        return preg_replace('/\s+/', ' ', trim($text));
    }

    /**
     * Tokenize text into words, removing stopwords and short words.
     */
    public function tokenize(string $text, ?array $extraStopwords = null): array
    {
        $normalized = $this->normalize($text);
        $words = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY);

        $stopwords = $this->stopwords;
        if ($extraStopwords) {
            foreach ($extraStopwords as $sw) {
                $stopwords[mb_strtolower($sw)] = true;
            }
        }

        return array_values(array_filter($words, function ($word) use ($stopwords) {
            return mb_strlen($word) >= $this->minWordLength && !isset($stopwords[$word]);
        }));
    }

    /**
     * Simple Spanish stemmer based on suffix removal rules.
     * Implements a subset of the Snowball Spanish stemming algorithm.
     */
    public function stem(string $word): string
    {
        if (mb_strlen($word) < 4) {
            return $word;
        }

        // Step 1: Remove attached pronoun suffixes
        $word = $this->removePronouns($word);

        // Step 2: Standard suffix removal
        $word = $this->removeSuffix($word);

        // Step 3: Residual suffix
        $word = $this->removeResidualSuffix($word);

        // Step 4: Remove accents
        $word = $this->removeAccents($word);

        return $word;
    }

    private function removePronouns(string $word): string
    {
        $suffixes = [
            'selas',
            'selos',
            'sela',
            'selo',
            'mela',
            'melo',
            'nos',
            'las',
            'les',
            'los',
            'nos',
            'les',
            'la',
            'le',
            'lo',
            'me',
            'se',
        ];

        $gerundPrefixes = ['iendo', 'ando', 'ándo', 'iéndo'];
        $infinitivePrefixes = ['ar', 'er', 'ir'];

        foreach ($suffixes as $suffix) {
            $len = mb_strlen($suffix);
            if (mb_strlen($word) > $len + 4 && mb_substr($word, -$len) === $suffix) {
                $stem = mb_substr($word, 0, -$len);
                // Check if the remainder looks like a verb stem
                foreach ($gerundPrefixes as $gp) {
                    if (mb_strlen($stem) >= mb_strlen($gp) && mb_substr($stem, -mb_strlen($gp)) === $gp) {
                        return $stem;
                    }
                }
                foreach ($infinitivePrefixes as $ip) {
                    if (mb_strlen($stem) >= mb_strlen($ip) && mb_substr($stem, -mb_strlen($ip)) === $ip) {
                        return $stem;
                    }
                }
            }
        }

        return $word;
    }

    private function removeSuffix(string $word): string
    {
        // Longest match first
        $suffixGroups = [
            // Verb suffixes (large group)
            ['aríamos', 'eríamos', 'iríamos', 'iésemos', 'iéramos'],
            ['aríais', 'eríais', 'iríais', 'aremos', 'eremos', 'iremos'],
            ['arían', 'erían', 'irían', 'ieran', 'iesen', 'ieron', 'iendo', 'aréis', 'eréis', 'iréis'],
            ['aría', 'ería', 'iría', 'aban', 'aran', 'ían', 'aste', 'iste'],
            ['ando', 'amos', 'imos', 'ados', 'idos', 'ando', 'aron', 'ería'],
            // Noun/adjective suffixes
            ['aciones', 'imientos', 'amiento'],
            ['idades', 'amente', 'encias', 'ancias', 'adores', 'adoras'],
            ['ación', 'amiento', 'imiento', 'idades'],
            ['encia', 'ancia', 'mente', 'istas', 'adora', 'ador'],
            ['idad', 'ismo', 'ista', 'ible', 'able', 'ante', 'ente', 'ción', 'sión'],
            ['oso', 'osa', 'ivo', 'iva', 'ero', 'era', 'dor', 'dora'],
            ['al', 'ar', 'er', 'ir', 'os', 'as', 'es', 'ad', 'ed', 'id'],
        ];

        foreach ($suffixGroups as $group) {
            foreach ($group as $suffix) {
                $len = mb_strlen($suffix);
                if (mb_strlen($word) > $len + 2 && mb_substr($word, -$len) === $suffix) {
                    return mb_substr($word, 0, -$len);
                }
            }
        }

        return $word;
    }

    private function removeResidualSuffix(string $word): string
    {
        $len = mb_strlen($word);
        if ($len > 3) {
            $last = mb_substr($word, -1);
            if (in_array($last, ['o', 'a', 'e', 'í', 'ó', 'á'])) {
                return mb_substr($word, 0, -1);
            }
        }
        return $word;
    }

    private function removeAccents(string $word): string
    {
        $accents = ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u'];
        return strtr($word, $accents);
    }

    /**
     * Tokenize and stem, returning an array of stems with original word mapping.
     * Returns: ['stems' => [...], 'stemToWords' => ['stem' => ['original1', 'original2']]]
     */
    public function tokenizeAndStem(string $text, ?array $extraStopwords = null): array
    {
        $words = $this->tokenize($text, $extraStopwords);
        $stems = [];
        $stemToWords = [];

        foreach ($words as $word) {
            $stemmed = $this->stem($word);
            $stems[] = $stemmed;

            if (!isset($stemToWords[$stemmed])) {
                $stemToWords[$stemmed] = [];
            }
            if (!in_array($word, $stemToWords[$stemmed])) {
                $stemToWords[$stemmed][] = $word;
            }
        }

        return [
            'stems' => $stems,
            'stemToWords' => $stemToWords,
        ];
    }

    /**
     * Extract n-grams from a token list.
     * Returns array of n-gram strings (space-joined).
     */
    public function extractNgrams(array $tokens, int $n): array
    {
        $ngrams = [];
        $count = count($tokens);

        for ($i = 0; $i <= $count - $n; $i++) {
            $ngram = implode(' ', array_slice($tokens, $i, $n));
            $ngrams[] = $ngram;
        }

        return $ngrams;
    }

    /**
     * Count word/phrase frequencies across multiple texts, with stemming and n-grams.
     *
     * Returns:
     * [
     *   'unigrams' => ['word' => count, ...],
     *   'bigrams' => ['word1 word2' => count, ...],
     *   'trigrams' => ['word1 word2 word3' => count, ...],
     *   'stemToDisplay' => ['stem' => 'most_common_original', ...],
     * ]
     */
    public function countFrequencies(
        array $texts,
        bool $useStemming = true,
        int $maxNgram = 2,
        ?array $extraStopwords = null
    ): array {
        $unigramCounts = [];
        $bigramCounts = [];
        $trigramCounts = [];
        $stemToWords = []; // stem => [word => count]
        $totalDocCount = count($texts);

        // For document frequency (DF) calculation
        $unigramDocFreq = [];

        foreach ($texts as $text) {
            if (empty($text)) continue;

            $words = $this->tokenize($text, $extraStopwords);

            if ($useStemming) {
                $stemResult = $this->tokenizeAndStem($text, $extraStopwords);
                $tokens = $stemResult['stems'];

                // Track stem→word mapping with counts
                foreach ($stemResult['stemToWords'] as $stem => $originals) {
                    if (!isset($stemToWords[$stem])) {
                        $stemToWords[$stem] = [];
                    }
                    foreach ($originals as $orig) {
                        $stemToWords[$stem][$orig] = ($stemToWords[$stem][$orig] ?? 0) + 1;
                    }
                }
            } else {
                $tokens = $words;
            }

            // Unigrams
            $docUniqueTokens = [];
            foreach ($tokens as $token) {
                $unigramCounts[$token] = ($unigramCounts[$token] ?? 0) + 1;
                $docUniqueTokens[$token] = true;
            }

            // Document frequency
            foreach ($docUniqueTokens as $token => $_) {
                $unigramDocFreq[$token] = ($unigramDocFreq[$token] ?? 0) + 1;
            }

            // Bigrams (from original words, not stems, for readability)
            if ($maxNgram >= 2 && count($words) >= 2) {
                $bigrams = $this->extractNgrams($words, 2);
                foreach ($bigrams as $bg) {
                    $bigramCounts[$bg] = ($bigramCounts[$bg] ?? 0) + 1;
                }
            }

            // Trigrams
            if ($maxNgram >= 3 && count($words) >= 3) {
                $trigrams = $this->extractNgrams($words, 3);
                foreach ($trigrams as $tg) {
                    $trigramCounts[$tg] = ($trigramCounts[$tg] ?? 0) + 1;
                }
            }
        }

        // Build stem→display mapping (most common original word for each stem)
        $stemToDisplay = [];
        foreach ($stemToWords as $stem => $originals) {
            arsort($originals);
            $stemToDisplay[$stem] = array_key_first($originals);
        }

        // Sort all by frequency
        arsort($unigramCounts);
        arsort($bigramCounts);
        arsort($trigramCounts);

        // Filter n-grams by minimum frequency
        $minFreq = config('nlp.ngrams.min_frequency', 2);
        $bigramCounts = array_filter($bigramCounts, fn($c) => $c >= $minFreq);
        $trigramCounts = array_filter($trigramCounts, fn($c) => $c >= $minFreq);

        return [
            'unigrams' => $unigramCounts,
            'bigrams' => $bigramCounts,
            'trigrams' => $trigramCounts,
            'stemToDisplay' => $stemToDisplay,
            'docFrequencies' => $unigramDocFreq,
            'totalDocuments' => $totalDocCount,
        ];
    }

    /**
     * Compute TF-IDF scores for terms across documents.
     *
     * @param array $termFrequencies ['term' => total_count]
     * @param array $docFrequencies  ['term' => num_docs_containing_term]
     * @param int   $totalDocuments  Total number of documents
     * @return array ['term' => tfidf_score]
     */
    public function computeTfIdf(array $termFrequencies, array $docFrequencies, int $totalDocuments): array
    {
        $scores = [];
        $totalTerms = array_sum($termFrequencies) ?: 1;

        foreach ($termFrequencies as $term => $freq) {
            $tf = $freq / $totalTerms;
            $df = $docFrequencies[$term] ?? 1;
            $idf = log(($totalDocuments + 1) / ($df + 1)) + 1; // Smoothed IDF
            $scores[$term] = round($tf * $idf, 6);
        }

        arsort($scores);
        return $scores;
    }

    /**
     * Classify texts into keyword-based categories using TF-IDF scoring.
     * Each text can match multiple categories (up to multi_keyword_limit).
     *
     * Returns:
     * [
     *   'categories' => ['keyword' => count, ...],
     *   'unclassified' => int,
     *   'keywords_used' => [...],
     * ]
     */
    public function classifyTexts(
        array $texts,
        int $numCategories = 15,
        ?array $extraStopwords = null
    ): array {
        $config = config('nlp.classification', []);
        $multiLimit = $config['multi_keyword_limit'] ?? 3;

        // Get frequency data
        $freq = $this->countFrequencies($texts, true, 2, $extraStopwords);

        // Use TF-IDF to find the most representative terms
        $tfidfScores = $this->computeTfIdf(
            $freq['unigrams'],
            $freq['docFrequencies'],
            $freq['totalDocuments']
        );

        // Pick top keywords by TF-IDF (use display form)
        $topStems = array_slice(array_keys($tfidfScores), 0, $numCategories);
        $topKeywords = [];
        foreach ($topStems as $stem) {
            $display = $freq['stemToDisplay'][$stem] ?? $stem;
            $topKeywords[$stem] = $display;
        }

        // Also consider top bigrams as candidate categories
        $topBigrams = array_slice(array_keys($freq['bigrams']), 0, min(5, $numCategories));

        // Classify each text
        $categoryCounts = array_fill_keys(array_values($topKeywords), 0);
        foreach ($topBigrams as $bg) {
            $categoryCounts[$bg] = 0;
        }
        $unclassified = 0;

        foreach ($texts as $text) {
            if (empty($text)) continue;

            $normalized = $this->normalize($text);
            $matched = 0;

            // Check bigrams first (more specific)
            foreach ($topBigrams as $bigram) {
                if (mb_strpos($normalized, $bigram) !== false) {
                    $categoryCounts[$bigram]++;
                    $matched++;
                    if ($matched >= $multiLimit) break;
                }
            }

            if ($matched < $multiLimit) {
                // Check unigrams (by stem)
                $stemResult = $this->tokenizeAndStem($text, $extraStopwords);
                $textStems = array_unique($stemResult['stems']);

                foreach ($topStems as $stem) {
                    if (in_array($stem, $textStems)) {
                        $display = $topKeywords[$stem];
                        $categoryCounts[$display]++;
                        $matched++;
                        if ($matched >= $multiLimit) break;
                    }
                }
            }

            if ($matched === 0) {
                $unclassified++;
            }
        }

        // Sort by count and remove zeros
        arsort($categoryCounts);
        $categoryCounts = array_filter($categoryCounts, fn($c) => $c > 0);

        return [
            'categories' => $categoryCounts,
            'unclassified' => $unclassified,
            'keywords_used' => array_values($topKeywords),
        ];
    }

    /**
     * Perform basic sentiment analysis on an array of texts.
     *
     * Returns:
     * [
     *   'overall' => 'positive'|'negative'|'neutral',
     *   'score' => float (-1 to 1),
     *   'distribution' => ['positive' => int, 'negative' => int, 'neutral' => int],
     *   'total' => int,
     * ]
     */
    public function analyzeSentiment(array $texts): array
    {
        $positiveCount = 0;
        $negativeCount = 0;
        $neutralCount = 0;
        $totalScore = 0;
        $validTexts = 0;

        foreach ($texts as $text) {
            if (empty($text)) continue;

            $words = preg_split('/\s+/', $this->normalize($text), -1, PREG_SPLIT_NO_EMPTY);
            $posWords = 0;
            $negWords = 0;

            foreach ($words as $word) {
                if (isset($this->sentimentLexicon['positive'][$word])) {
                    $posWords++;
                }
                if (isset($this->sentimentLexicon['negative'][$word])) {
                    $negWords++;
                }
            }

            $total = $posWords + $negWords;
            if ($total === 0) {
                $neutralCount++;
            } elseif ($posWords > $negWords) {
                $positiveCount++;
                $totalScore += ($posWords - $negWords) / $total;
            } elseif ($negWords > $posWords) {
                $negativeCount++;
                $totalScore -= ($negWords - $posWords) / $total;
            } else {
                $neutralCount++;
            }

            $validTexts++;
        }

        $avgScore = $validTexts > 0 ? round($totalScore / $validTexts, 3) : 0;

        return [
            'overall' => $avgScore > 0.05 ? 'positive' : ($avgScore < -0.05 ? 'negative' : 'neutral'),
            'score' => $avgScore,
            'distribution' => [
                'positive' => $positiveCount,
                'negative' => $negativeCount,
                'neutral' => $neutralCount,
            ],
            'total' => $validTexts,
        ];
    }

    /**
     * Get the merged stopwords set.
     */
    public function getStopwords(): array
    {
        return $this->stopwords;
    }

    /**
     * Check if a word is a stopword.
     */
    public function isStopword(string $word): bool
    {
        return isset($this->stopwords[mb_strtolower($word)]);
    }
}
