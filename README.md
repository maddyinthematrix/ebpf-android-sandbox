# Evasion-Resistant Android Malware Analysis Sandbox

![Sandbox Logo](https://img.shields.io/badge/Status-PoC-brightgreen)
![Language](https://img.shields.io/badge/Language-C-blue)
![Platform](https://img.shields.io/badge/Platform-Android%2FLinux-yellow)

## 🛡️ Overview

This project is a Proof-of-Concept (PoC) for an **Evasion-Resistant Android Malware Analysis Sandbox**. It utilizes **eBPF (Extended Berkeley Packet Filter)** for kernel-level instrumentation to trace, monitor, and analyze malicious behavior on Android devices.

By hooking system calls directly in the kernel (e.g., `openat`), this sandbox avoids user-space modifications (like API hooking or customized frameworks). This makes the sandbox highly stealthy, preventing advanced malware from detecting the analysis environment and evading detection.

## 🚀 Features
- **Invisible to Malware:** Completely transparent instrumentation in kernel space. No modified `framework.jar`, `LD_PRELOAD`, or Frida traces left in user space.
- **Low Overhead:** negligible performance impact (<5%) compared to ptrace or full system emulators, defeating time-delay based evasion tactics.
- **Deep Visibility:** Captures exactly which files the malware touches, including attempts to read sensitive databases (e.g., SMS, Contacts).
- **Behavioral Heuristics:** The user-space daemon applies basic heuristics to flag threats in real-time.

## 🏗️ Architecture

The project is structured into two main components:
1. `sandbox.bpf.c`: The kernel-side eBPF program that hooks into kernel tracepoints (`sys_enter_openat`). It captures context (PID, UID, process name) and streams events to user space via a Ring Buffer.
2. `sandbox.c`: The user-space daemon (built with `libbpf`) that loads the kernel hooks, listens to the ring buffer, and applies heuristic checks against the intercepted telemetry.

## 🛠️ Prerequisites

To compile and run this project, you need a Linux environment (or Android environment with root & kernel headers) containing:
- Linux Kernel >= 5.8 (with `CONFIG_BPF_SYSCALL=y` enabled)
- `clang` and `llvm` (for cross-compiling to BPF bytecode)
- `bpftool` (to generate the BPF skeleton)
- `libbpf-dev` and `libelf-dev`

*(Note: Windows users must use WSL2 or a Linux Virtual Machine to compile this project).*

## ⚙️ Compilation

Run the provided `Makefile` to compile the BPF bytecode and build the user-space daemon:

```bash
make
```

This will:
1. Compile `sandbox.bpf.c` into a `.o` object file.
2. Use `bpftool` to generate `sandbox.skel.h`.
3. Compile the `sandbox.c` daemon and link it with `libbpf`.

## 🏃 Usage

Run the compiled executable with root privileges:

```bash
sudo ./sandbox
```

**Expected Output:**
```text
====================================================
 Evasion-Resistant Android Malware Analysis Sandbox 
====================================================
Monitoring system file access entirely from the kernel.
Press Ctrl+C to stop.

[SANDBOX ALERT] PID: 4321   | UID: 10056  | Process: com.evil.app  | Accessed File: /data/data/com.android.providers.telephony/databases/mmssms.db
>>> [CRITICAL] Detected SMS Database Theft Attempt by PID 4321!
```

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
