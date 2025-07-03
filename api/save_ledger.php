<?php
/**
 * save_ledger.php
 *
 * POST로 받은 year, month, data 배열, sections 객체를 
 * data/{year}/{month}.json 파일에 저장합니다.
 */

header('Content-Type: application/json; charset=utf-8');

// POST 바디(JSON)를 읽어서 파싱
$body = file_get_contents('php://input');
$payload = json_decode($body, true);

if ($payload === null) {
    echo json_encode(['success' => false, 'error' => '잘못된 JSON 형식입니다.']);
    exit;
}

$year     = isset($payload['year'])     ? preg_replace('/[^0-9]/','', $payload['year'])     : '';
$month    = isset($payload['month'])    ? preg_replace('/[^0-9]/','', $payload['month'])    : '';
$data     = isset($payload['data'])     ? $payload['data']     : null;
$sections = isset($payload['sections']) ? $payload['sections'] : null;

// 필수값 검증
if (!$year || !$month || !is_array($data) || !is_array($sections)) {
    echo json_encode(['success' => false, 'error' => '필요한 데이터가 없습니다.']);
    exit;
}

// 저장할 디렉터리 경로 생성
$baseDir = __DIR__ . '/../data';
$yearDir = $baseDir . '/' . $year;
if (!is_dir($yearDir)) {
    // 연도 폴더가 없으면 생성
    if (!mkdir($yearDir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => '연도 디렉터리 생성 실패']);
        exit;
    }
}

// 파일 경로
$filename = $yearDir . '/' . sprintf('%02d', intval($month)) . '.json';

// JSON으로 인코딩: data와 sections를 함께 저장
$output = [
    'data'     => $data,
    'sections' => $sections
];

$jsonData = json_encode($output, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($jsonData === false) {
    echo json_encode(['success' => false, 'error' => 'JSON 변환 실패']);
    exit;
}

// 파일에 저장 (덮어쓰기)
$result = file_put_contents($filename, $jsonData);
if ($result === false) {
    echo json_encode(['success' => false, 'error' => '파일 저장 실패']);
    exit;
}

// 성공 응답
echo json_encode(['success' => true]);
exit;
