#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>
#include "sandbox.h"

// Define a BPF ring buffer to send data efficiently to user space
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024); // 256 KB buffer
} events SEC(".maps");

// Hook the 'openat' system call to monitor file access
SEC("tracepoint/syscalls/sys_enter_openat")
int tracepoint__syscalls__sys_enter_openat(struct trace_event_raw_sys_enter *ctx)
{
    struct event_t *event;
    
    // Reserve space in the ring buffer for our event data
    event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
    if (!event) {
        return 0; // Ring buffer full, drop event
    }

    // Get the Process ID and User ID of the app making the syscall
    u64 id = bpf_get_current_pid_tgid();
    event->pid = id >> 32;
    event->uid = bpf_get_current_uid_gid() & 0xFFFFFFFF;

    // Get the name of the current process
    bpf_get_current_comm(&event->comm, sizeof(event->comm));

    // ctx->args[1] contains the pointer to 'pathname'
    const char *pathname = (const char *)ctx->args[1];
    
    // Safely read the filename string from user space memory
    bpf_probe_read_user_str(&event->filename, sizeof(event->filename), pathname);

    // Submit the event to user space
    bpf_ringbuf_submit(event, 0);

    return 0;
}

char _license[] SEC("license") = "GPL";
