<?php
// --- Configuration ---
$baseDir = __DIR__;
$slidesDir = $baseDir;
$baseUrl = './';

// --- Fonction récursive pour scanner les dossiers ---
function scanSlidesHierarchy($dir, $baseUrl = './') {
    $structure = [
        'folders' => [],
        'slides' => []
    ];

    if (!is_dir($dir)) return $structure;

    $items = scandir($dir);
    $items = array_diff($items, ['.', '..']);
    natsort($items);

    foreach ($items as $item) {
        $fullPath = $dir . DIRECTORY_SEPARATOR . $item;

        if (is_dir($fullPath)) {
            $subStructure = scanSlidesHierarchy($fullPath, $baseUrl . rawurlencode($item) . '/');
            if (!empty($subStructure['slides']) || !empty($subStructure['folders'])) {
                $structure['folders'][$item] = $subStructure;
            }
        } elseif (strtolower(pathinfo($item, PATHINFO_EXTENSION)) === 'html' && $item !== 'index.php') {
            $structure['slides'][$item] = [
                'name' => preg_replace('/\.html$/', '', $item),
                'path' => $baseUrl . rawurlencode($item),
                'file' => $item
            ];
        }
    }

    return $structure;
}

// --- Fonction pour afficher la hiérarchie ---
function renderHierarchy($structure, $level = 0) {
    $html = '';
    $uniqueId = uniqid('accordion_');

    // Afficher les slides du niveau courant
    if (!empty($structure['slides'])) {
        $html .= '<div class="slides-grid">';
        foreach ($structure['slides'] as $slide) {
            $html .= '
            <div class="slide-card">
              <div class="card shadow-sm h-100">
                <div class="card-body">
                  <h5 class="card-title mb-2">
                    <a href="' . htmlspecialchars($slide['path'], ENT_QUOTES) . '" target="_blank" class="text-decoration-none">
                      ' . htmlspecialchars($slide['name'], ENT_QUOTES, 'UTF-8') . '
                    </a>
                  </h5>
                  <p class="card-text text-muted small mb-0">Présentation MARP</p>
                </div>
              </div>
            </div>';
        }
        $html .= '</div>';
    }

    // Afficher les dossiers avec accordéon
    if (!empty($structure['folders'])) {
        $html .= '<div class="accordion mt-4" id="' . $uniqueId . '">';
        $itemIndex = 0;

        foreach ($structure['folders'] as $folderName => $subStructure) {
            $collapsedId = $uniqueId . '_' . $itemIndex;
            $html .= '
            <div class="card mb-2 border-light">
              <div class="card-header bg-light p-0">
                <button class="btn btn-link btn-block text-left" type="button" data-toggle="collapse" data-target="#' . $collapsedId . '" aria-expanded="false">
                  <span class="folder-icon">📁</span> ' . htmlspecialchars($folderName, ENT_QUOTES, 'UTF-8') . '
                </button>
              </div>
              <div id="' . $collapsedId . '" class="collapse" data-parent="#' . $uniqueId . '">
                <div class="card-body">
                  ' . renderHierarchy($subStructure, $level + 1) . '
                </div>
              </div>
            </div>';
            $itemIndex++;
        }

        $html .= '</div>';
    }

    return $html;
}

$hierarchy = scanSlidesHierarchy($slidesDir, $baseUrl);
$hasContent = !empty($hierarchy['slides']) || !empty($hierarchy['folders']);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Présentations disponibles</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --color-primary: #004595;
      --color-primary-light: #2563EB;
      --color-primary-lighter: #DBEAFE;
      --color-primary-dark: #003366;
      --color-text: #1F2937;
      --color-text-light: #6B7280;
      --color-bg: #FFFFFF;
      --color-bg-soft: #F9FAFB;
      --color-bg-accent: #F0F4FF;
      --color-border: #E5E7EB;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      --radius-md: 8px;
      --transition-fast: 0.15s ease-in-out;
    }

    * {
      font-family: 'Lexend', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      background: var(--color-bg-soft);
      color: var(--color-text);
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .container {
      background: var(--color-bg);
      border-radius: var(--radius-md);
      padding: 2.5rem;
      box-shadow: var(--shadow-md);
      max-width: 1200px;
    }

    h1 {
      background: linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 2rem;
      font-weight: 700;
      font-size: 2rem;
    }

    .slides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .slide-card {
      height: 100%;
    }

    .card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      overflow: hidden;
      background: var(--color-bg);
    }

    .card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
      border-color: var(--color-primary-light);
    }

    .card-body {
      padding: 1.25rem;
    }

    .card-title {
      margin-bottom: 0.75rem;
    }

    .card a {
      color: var(--color-primary);
      font-weight: 600;
      text-decoration: none;
      transition: all var(--transition-fast);
      position: relative;
    }

    .card a::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
      transition: width var(--transition-fast);
    }

    .card a:hover::after {
      width: 100%;
    }

    .card-text {
      color: var(--color-text-light);
    }

    .accordion .card {
      border: 1px solid var(--color-border);
      margin-bottom: 0.75rem;
    }

    .accordion .card-header {
      border-bottom: none;
      background: var(--color-bg-soft);
      padding: 0;
    }

    .accordion .btn-link {
      color: var(--color-primary);
      font-weight: 600;
      padding: 1rem;
      text-decoration: none;
      display: block;
      width: 100%;
      text-align: left;
      transition: all var(--transition-fast);
    }

    .accordion .btn-link:hover {
      color: var(--color-primary-dark);
      background: var(--color-bg-accent);
      text-decoration: none;
    }

    .accordion .btn-link::after {
      float: right;
      transition: transform var(--transition-fast);
    }

    .accordion .btn-link[aria-expanded="true"]::after {
      transform: rotate(-180deg);
    }

    .accordion .card-body {
      padding: 1.5rem;
      background: var(--color-bg);
    }

    .folder-icon {
      margin-right: 0.5rem;
      font-size: 1.1em;
    }

    .alert {
      background: var(--color-bg-accent);
      border: 1px solid var(--color-primary-lighter);
      color: var(--color-primary-dark);
      border-radius: var(--radius-md);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Présentations disponibles</h1>

    <?php if (!$hasContent): ?>
      <div class="alert">
        <strong>ℹ️ Aucune présentation trouvée.</strong> Les fichiers HTML générés par MARP apparaîtront ici.
      </div>
    <?php else: ?>
      <?php echo renderHierarchy($hierarchy); ?>
    <?php endif; ?>
  </div>

  <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js"></script>
  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js"></script>
</body>
</html>
