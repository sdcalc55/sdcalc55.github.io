#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <string>
#include <vector>
#include <algorithm>

#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "Shlwapi.lib")

static constexpr wchar_t kMutexName[] = L"Local\\SDCalculator.SingleInstance.2026";
static constexpr wchar_t kWindowTitle[] = L"SD | Калькулятор";
static constexpr wchar_t kAppUrl[] = L"https://sdcalc55.github.io/";

struct WindowSearch {
    HWND hwnd = nullptr;
};

static BOOL CALLBACK FindAppWindow(HWND hwnd, LPARAM param) {
    auto* search = reinterpret_cast<WindowSearch*>(param);
    if (!IsWindowVisible(hwnd)) return TRUE;

    wchar_t title[512]{};
    GetWindowTextW(hwnd, title, static_cast<int>(std::size(title)));
    if (wcsstr(title, kWindowTitle) != nullptr) {
        search->hwnd = hwnd;
        return FALSE;
    }
    return TRUE;
}

static HWND FindAppWindow() {
    WindowSearch search;
    EnumWindows(FindAppWindow, reinterpret_cast<LPARAM>(&search));
    return search.hwnd;
}

static void Activate(HWND hwnd) {
    if (!hwnd || !IsWindow(hwnd)) return;
    if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
    else ShowWindow(hwnd, SW_SHOW);
    DWORD foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), nullptr);
    DWORD targetThread = GetWindowThreadProcessId(hwnd, nullptr);
    DWORD currentThread = GetCurrentThreadId();
    AttachThreadInput(currentThread, foregroundThread, TRUE);
    AttachThreadInput(currentThread, targetThread, TRUE);
    SetForegroundWindow(hwnd);
    BringWindowToTop(hwnd);
    SetFocus(hwnd);
    AttachThreadInput(currentThread, targetThread, FALSE);
    AttachThreadInput(currentThread, foregroundThread, FALSE);
}

static std::wstring ReadAppPath(HKEY root, const wchar_t* subkey) {
    wchar_t value[32768]{};
    DWORD size = sizeof(value);
    DWORD type = 0;
    if (RegGetValueW(root, subkey, nullptr, RRF_RT_REG_SZ, &type, value, &size) == ERROR_SUCCESS) {
        std::wstring path(value);
        size_t quote = path.find(L'"');
        if (quote == 0) {
            size_t end = path.find(L'"', 1);
            if (end != std::wstring::npos) path = path.substr(1, end - 1);
        }
        return path;
    }
    return L"";
}

static std::wstring FindBrowser() {
    const wchar_t* keys[] = {
        L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
        L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe"
    };
    for (const auto* key : keys) {
        auto path = ReadAppPath(HKEY_CURRENT_USER, key);
        if (path.empty()) path = ReadAppPath(HKEY_LOCAL_MACHINE, key);
        if (!path.empty() && GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES) return path;
    }

    wchar_t* env = nullptr;
    size_t len = 0;
    if (_wdupenv_s(&env, &len, L"PROGRAMFILES") == 0 && env) {
        std::wstring base(env); free(env);
        std::vector<std::wstring> candidates = {
            base + L"\\Google\\Chrome\\Application\\chrome.exe",
            base + L"\\Microsoft\\Edge\\Application\\msedge.exe"
        };
        for (const auto& path : candidates)
            if (GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES) return path;
    }
    if (_wdupenv_s(&env, &len, L"PROGRAMFILES(X86)") == 0 && env) {
        std::wstring base(env); free(env);
        std::vector<std::wstring> candidates = {
            base + L"\\Google\\Chrome\\Application\\chrome.exe",
            base + L"\\Microsoft\\Edge\\Application\\msedge.exe"
        };
        for (const auto& path : candidates)
            if (GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES) return path;
    }
    return L"";
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    HANDLE mutex = CreateMutexW(nullptr, TRUE, kMutexName);
    if (!mutex) {
        MessageBoxW(nullptr, L"Не удалось запустить SD | Калькулятор.", L"SD | Калькулятор", MB_ICONERROR);
        return 1;
    }

    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND hwnd = nullptr;
        for (int i = 0; i < 60 && !hwnd; ++i) {
            hwnd = FindAppWindow();
            if (!hwnd) Sleep(250);
        }
        if (hwnd) Activate(hwnd);
        CloseHandle(mutex);
        return 0;
    }

    const auto browser = FindBrowser();
    if (browser.empty()) {
        MessageBoxW(nullptr, L"Не найден Google Chrome или Microsoft Edge. Установите один из этих браузеров и повторите запуск.", L"SD | Калькулятор", MB_ICONWARNING);
        ReleaseMutex(mutex);
        CloseHandle(mutex);
        return 2;
    }

    std::wstring args = L"\"" + browser + L"\" --app=\"" + kAppUrl + L"\"";
    STARTUPINFOW si{}; si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    std::vector<wchar_t> command(args.begin(), args.end());
    command.push_back(L'\0');
    if (!CreateProcessW(nullptr, command.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi)) {
        MessageBoxW(nullptr, L"Не удалось открыть браузер.", L"SD | Калькулятор", MB_ICONERROR);
        ReleaseMutex(mutex);
        CloseHandle(mutex);
        return 3;
    }
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);

    HWND appWindow = nullptr;
    for (int i = 0; i < 120 && !appWindow; ++i) {
        appWindow = FindAppWindow();
        if (!appWindow) Sleep(250);
    }
    if (!appWindow) {
        MessageBoxW(nullptr, L"Окно калькулятора не найдено. Проверьте подключение к интернету и попробуйте снова.", L"SD | Калькулятор", MB_ICONWARNING);
        ReleaseMutex(mutex);
        CloseHandle(mutex);
        return 4;
    }

    while (IsWindow(appWindow)) {
        HWND current = FindAppWindow();
        if (current) appWindow = current;
        Sleep(500);
    }

    ReleaseMutex(mutex);
    CloseHandle(mutex);
    return 0;
}
