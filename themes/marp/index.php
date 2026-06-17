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
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .container {
      background: white;
      border-radius: 0.75rem;
      padding: 2rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    h1 {
      color: #667eea;
      margin-bottom: 1.5rem;
      font-weight: 700;
    }

    .slides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .slide-card {
      height: 100%;
    }

    .card {
      border: none;
      border-radius: 0.75rem;
      transition: transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
      overflow: hidden;
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    }

    .card a {
      color: #667eea;
      font-weight: 600;
      transition: color 0.15s ease-in-out;
    }

    .card a:hover {
      color: #764ba2;
      text-decoration: none;
    }

    .accordion .card-header {
      border-bottom: none;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .accordion .btn-link {
      color: #667eea;
      font-weight: 600;
      padding: 1rem;
      text-decoration: none;
    }

    .accordion .btn-link:hover {
      color: #764ba2;
      text-decoration: none;
    }

    .folder-icon {
      margin-right: 0.5rem;
      font-size: 1.1em;
    }

    .alert {
      background: #f8f9fa;
      border: 2px dashed #dee2e6;
      color: #495057;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Présentations disponibles</h1>

    <?php if (!$hasContent): ?>
      <div class="alert alert-warning">
        <strong>Aucune présentation trouvée.</strong> Les fichiers HTML générés par MARP apparaîtront ici.
      </div>
    <?php else: ?>
      <?php echo renderHierarchy($hierarchy); ?>
    <?php endif; ?>
  </div>

  <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js"></script>
  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js"></script>
</body>
</html>
