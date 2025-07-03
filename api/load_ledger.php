<?php
/**
 * load_ledger.php
 *
 * GET으로 받은 year, month에 해당하는 data/{year}/{month}.json 파일을 읽어 반환합니다.
 * 파일이 없으면 빈 data, 빈 sections 객체를 반환합니다.
 */

header('Content-Type: application/json; charset=utf-8');

// GET 파라미터
$year  = isset($_GET['year'])  ? preg_replace('/[^0-9]/','', $_GET['year'])  : '';
$month = isset($_GET['month']) ? preg_replace('/[^0-9]/','', $_GET['month']) : '';

// 필수값 검증
if (!$year || !$month) {
    echo json_encode(['success' => false, 'error' => '연도 또는 월이 올바르지 않습니다.']);
    exit;
}

// 저장 폴더 경로 설정
$baseDir = __DIR__ . '/../data';
$yearDir = $baseDir . '/' . $year;
$filename = $yearDir . '/' . sprintf('%02d', intval($month)) . '.json';

// 파일이 없으면 빈 데이터/빈 sections 반환
if (!file_exists($filename)) {
    echo json_encode([
        'success'  => true,
        'data'     => [], 
        'sections' => new stdClass()   // 빈 객체
    ]);
    exit;
}

// 파일 읽기
$json = file_get_contents($filename);
if ($json === false) {
    echo json_encode(['success' => false, 'error' => '파일을 읽는 중 오류 발생']);
    exit;
}

// JSON 파싱
$parsed = json_decode($json, true);
if ($parsed === null) {
    echo json_encode(['success' => false, 'error' => '데이터 파싱 중 오류 발생']);
    exit;
}

// JSON이 두 가지 형태일 수 있음
// 1) { "data": [.], "sections": {.} }  (현재 저장 포맷)
// 2) [. ]                             (구버전: data 배열만 있던 형식)
if (isset($parsed['data']) && isset($parsed['sections'])) {
    $data = $parsed['data'];
    $sections = $parsed['sections'];
} else {
    // 구버전 처리: parsed를 데이터 배열로 간주, sections는 빈 객체
    $data = $parsed;
    $sections = new stdClass();
}

echo json_encode([
    'success'  => true,
    'data'     => $data,
    'sections' => $sections
]);
exit;
