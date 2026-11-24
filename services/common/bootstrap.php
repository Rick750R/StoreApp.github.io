<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $host = getenv('DB_HOST') ?: 'database';
    $port = getenv('DB_PORT') ?: '3306';
    $name = getenv('DB_NAME') ?: 'catalogo_tienda';
    $user = getenv('DB_USER') ?: 'storeapp';
    $pass = getenv('DB_PASSWORD') ?: 'storeapp_password';
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
function json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function out(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $message, int $status = 400): never { out(['message' => $message], $status); }
function method(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }
function path_info(): string {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    return '/' . trim($path, '/');
}
function cookie_token(): ?string {
    $token = $_COOKIE['storeapp_sid'] ?? '';
    return preg_match('/^[a-f0-9]{64}$/i', $token) ? $token : null;
}
function set_session_cookie(string $token): void {
    setcookie('storeapp.sid', $token, [
        'expires' => time() + 604800, 'path' => '/', 'httponly' => true,
        'samesite' => 'Lax', 'secure' => (getenv('APP_ENV') === 'production'),
    ]);
}
function clear_session_cookie(): void {
    setcookie('storeapp.sid', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => (getenv('APP_ENV') === 'production')]);
}
function current_user(): ?array {
    $token = cookie_token();
    if (!$token) return null;
    $q = db()->prepare('SELECT u.id,u.nombre,u.correo,u.rol FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=? AND s.expira_en>NOW() AND u.activo=1 LIMIT 1');
    $q->execute([hash('sha256', $token)]);
    return $q->fetch() ?: null;
}
function need_user(): array {
    $user = current_user();
    if (!$user) fail('Debes iniciar sesión para continuar.', 401);
    return $user;
}
function need_admin(): array {
    $user = need_user();
    if ($user['rol'] !== 'administrador') fail('No tienes permisos para realizar esta acción.', 403);
    return $user;
}
function start_session(int $userId): void {
    $token = bin2hex(random_bytes(32));
    $q = db()->prepare('INSERT INTO sesiones (token_hash,usuario_id,expira_en) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))');
    $q->execute([hash('sha256', $token), $userId]);
    set_session_cookie($token);
}
function route_error(Throwable $e): never {
    error_log((string)$e);
    $code = (int)$e->getCode();
    if ($code < 400 || $code > 599) $code = 500;
    out(['message' => $code === 500 ? 'Ocurrió un error interno del servidor.' : $e->getMessage()], $code);
}
