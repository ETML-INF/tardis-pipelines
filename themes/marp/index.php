<?php
// --- Configuration ---
$baseDir = __DIR__;                       // Dossier où se trouve index.php
$slidesDir = $baseDir;                    // Les .html sont dans le même dossier
$baseUrl = './';                          // Liens relatifs

// --- Récupération des fichiers HTML ---
$files = glob($slidesDir . '/*.html');
natsort($files);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Présentations disponibles</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #f8f9fa; }
    h1 { margin-bottom: 1.5rem; }
    .card { border-radius: 0.75rem; transition: transform .15s ease-in-out; }
    .card:hover { transform: translateY(-3px); }
  </style>
</head>
<body class="p-4">
  <div class="container">
    <h1 class="mb-4">Présentations disponibles</h1>

    <?php if (empty($files)): ?>
      <div class="alert alert-warning">Aucune présentation HTML trouvée.</div>
    <?php else: ?>
      <div class="row">
        <?php foreach ($files as $filePath): 
          $fileName = basename($filePath);
          if ($fileName === 'index.php') continue; // éviter de s’auto-lister
          $title = preg_replace('/\.html$/', '', $fileName);
          $link = $baseUrl . rawurlencode($fileName);
        ?>
        <div class="col-md-6 col-lg-4 mb-3">
          <div class="card shadow-sm">
            <div class="card-body">
              <h5 class="card-title mb-2">
                <a href="<?php echo $link; ?>" target="_blank" class="stretched-link text-decoration-none">
                  <?php echo htmlspecialchars($title, ENT_QUOTES, 'UTF-8'); ?>
                </a>
              </h5>
              <p class="card-text text-muted small mb-0">HTML généré par MARP</p>
            </div>
          </div>
        </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
