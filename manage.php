<?php
// manage.php
// - data 폴더 아래 연도별 하위디렉터리를 재귀 탐색하여 모든 JSON 파일을 나열
// - 삭제 기능만 제공합니다. (이동 기능 제거, 리스트 형태 출력)

ini_set('display_errors', 1);
error_reporting(E_ALL);

// ─────────────────────────────────────────────────
// 1) “data” 폴더의 절대 경로를 지정합니다.
//    이 파일(manage.php)과 같은 폴더에 “data” 폴더가 있어야 합니다.
//    예) 
//      /var/www/html/index.html
//      /var/www/html/manage.php
//      /var/www/html/data/2025/06.json
// ─────────────────────────────────────────────────
$dataDir = __DIR__ . '/data';

// ─────────────────────────────────────────────────
// 2) POST 요청 처리: 삭제(delete) 기능
// ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $year   = preg_replace('/[^0-9]/', '', $_POST['year']   ?? '');
    $month  = preg_replace('/[^0-9]/', '', $_POST['month']  ?? '');

    if ($action === 'delete' && $year !== '' && $month !== '') {
        $yearDir     = $dataDir . '/' . $year;
        $filePath    = $yearDir . '/' . sprintf('%02d', intval($month)) . '.json';

        if (file_exists($filePath)) {
            unlink($filePath);
            // 연도 폴더가 비어 있으면 폴더까지 제거
            if (is_dir($yearDir) && count(scandir($yearDir)) === 2) {
                rmdir($yearDir);
            }
        }
    }

    // 삭제 후 다시 목록을 보여주기 위해 리다이렉트
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

// ─────────────────────────────────────────────────
// 3) 재귀 탐색으로 “data” 폴더 전체에서 JSON 파일 목록 구축
//    - data/YYYY/MM.json 형태로 저장된 파일들을 모두 찾는다.
//    - ['year','month','count','size'] 배열에 담습니다.
// ─────────────────────────────────────────────────
$allData = [];
if (is_dir($dataDir)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dataDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $file) {
        if ($file->isFile() && strtolower($file->getExtension()) === 'json') {
            $fullPath = $file->getRealPath();
            // dataDir 뒤의 상대 경로: ex) “2025/06.json”
            $relPath = substr($fullPath, strlen($dataDir) + 1);
            $parts  = explode('/', $relPath);

            if (count($parts) === 2) {
                $yearPart = $parts[0];
                $fileName = $parts[1]; // ex) “06.json”

                if (preg_match('/^([0-9]{2})\.json$/', $fileName, $m)) {
                    $year  = intval($yearPart);
                    $month = intval($m[1]);

                    // JSON 내용 파싱 후 항목 개수(count) 가져오기
                    $jsonContent = file_get_contents($fullPath);
                    $dataArr     = json_decode($jsonContent, true);
                    $count       = is_array($dataArr) ? count($dataArr) : 0;
                    $size        = filesize($fullPath);

                    $allData[] = [
                        'year'  => $year,
                        'month' => $month,
                        'count' => $count,
                        'size'  => $size
                    ];
                }
            }
        }
    }

    // 연도 오름차순 → 월 오름차순 정렬
    usort($allData, function($a, $b) {
        if ($a['year'] !== $b['year']) {
            return $a['year'] <=> $b['year'];
        }
        return $a['month'] <=> $b['month'];
    });
}
?>
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>가계부 데이터 관리</title>
  <style>
    body {
      font-family: 'Noto Sans KR', sans-serif;
      background-color: #f4f4f4;
      color: #333;
      padding: 20px;
    }
    h1 {
      margin-bottom: 16px;
      color: #2c3e50;
    }
    .top-link {
      margin-bottom: 12px;
    }
    .top-link button {
      padding: 6px 12px;
      background-color: #27ae60;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .top-link button:hover {
      background-color: #1e8449;
    }
    ul.data-list {
      list-style: none;
      padding: 0;
    }
    ul.data-list li {
      background-color: #fff;
      margin-bottom: 8px;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .item-info {
      font-size: 1rem;
      color: #2c3e50;
    }
    .item-actions form {
      display: inline-block;
      margin-left: 8px;
    }
    .item-actions button {
      padding: 4px 8px;
      font-size: 0.9rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn-delete {
      background-color: #e74c3c;
      color: #fff;
    }
    .btn-delete:hover {
      background-color: #c0392b;
    }
    .empty-message {
      font-size: 1rem;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>가계부 데이터 관리</h1>

  <div class="top-link">
    <!-- 메인 페이지로 돌아가기 버튼 -->
    <button onclick="location.href='index.html'">← 메인으로 돌아가기</button>
  </div>

  <?php if (empty($allData)): ?>
    <p class="empty-message">저장된 데이터가 없습니다.</p>
  <?php else: ?>
    <ul class="data-list">
      <?php foreach ($allData as $entry): 
        $year  = $entry['year'];
        $month = sprintf('%02d', $entry['month']);
        $count = $entry['count'];
        $size  = $entry['size'];
      ?>
        <li>
          <div class="item-info">
            <?= htmlspecialchars($year) ?>년 <?= htmlspecialchars($month) ?>월
            &nbsp;–&nbsp; 건수: <?= htmlspecialchars($count) ?>개
            &nbsp;–&nbsp; 크기: <?= htmlspecialchars($size) ?> bytes
          </div>
          <div class="item-actions">
            <!-- 삭제 버튼 -->
            <form method="POST" style="display:inline;">
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="year"  value="<?= htmlspecialchars($year) ?>" />
              <input type="hidden" name="month" value="<?= htmlspecialchars($month) ?>" />
              <button type="submit" class="btn-delete"
                      onclick="return confirm('정말 <?= $year ?>년 <?= $month ?>월 데이터를 삭제하시겠습니까?');">
                삭제
              </button>
            </form>
          </div>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</body>
</html>
