#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <stdbool.h>
#include <sys/resource.h>
#include <errno.h>
#include <bpf/libbpf.h>
#include "sandbox.h"
#include "sandbox.skel.h" 

static volatile bool exiting = false;

// Signal handler to gracefully stop the daemon
static void sig_handler(int sig)
{
    exiting = true;
}

// Callback function executed every time the kernel sends a new event
static int handle_event(void *ctx, void *data, size_t data_sz)
{
    const struct event_t *e = data;

    // Print the intercepted data
    printf("[SANDBOX ALERT] PID: %-6d | UID: %-6d | Process: %-15s | Accessed File: %s\n",
           e->pid, e->uid, e->comm, e->filename);
    
    // Simple Heuristics / Signatures
    if (strstr(e->filename, "mmssms.db")) { 
        printf(">>> [CRITICAL] Detected SMS Database Theft Attempt by PID %d!\n", e->pid);
    } else if (strstr(e->filename, "contacts2.db")) {
        printf(">>> [CRITICAL] Detected Contacts Theft Attempt by PID %d!\n", e->pid);
    } else if (strstr(e->filename, "/proc/") && strstr(e->filename, "maps")) {
        printf(">>> [WARNING] Detected possible Anti-Debugging / Sandbox Evasion by PID %d!\n", e->pid);
    }

    return 0;
}

int main(int argc, char **argv)
{
    struct sandbox_bpf *skel;
    struct ring_buffer *rb = NULL;
    int err;

    // Set up signal handler to exit gracefully on Ctrl+C
    signal(SIGINT, sig_handler);
    signal(SIGTERM, sig_handler);

    printf("====================================================\n");
    printf(" Evasion-Resistant Android Malware Analysis Sandbox \n");
    printf("====================================================\n");
    printf("Monitoring system file access entirely from the kernel.\n");
    printf("Press Ctrl+C to stop.\n\n");

    // Open and load the compiled eBPF program into the kernel
    skel = sandbox_bpf__open_and_load();
    if (!skel) {
        fprintf(stderr, "Failed to open and load BPF skeleton\n");
        return 1;
    }

    // Attach the eBPF program to the kernel tracepoints
    err = sandbox_bpf__attach(skel);
    if (err) {
        fprintf(stderr, "Failed to attach BPF skeleton\n");
        sandbox_bpf__destroy(skel);
        return 1;
    }

    // Set up the ring buffer to listen for events from the kernel
    rb = ring_buffer__new(bpf_map__fd(skel->maps.events), handle_event, NULL, NULL);
    if (!rb) {
        fprintf(stderr, "Failed to create ring buffer\n");
        sandbox_bpf__destroy(skel);
        return 1;
    }

    // Continuously poll the ring buffer for new malicious activity logs
    while (!exiting) {
        err = ring_buffer__poll(rb, 100 /* timeout in ms */);
        if (err == -EINTR) {
            err = 0;
            break;
        }
        if (err < 0) {
            printf("Error polling ring buffer: %d\n", err);
            break;
        }
    }

    printf("\nExiting and cleaning up eBPF programs...\n");

    // Cleanup before exiting
    ring_buffer__free(rb);
    sandbox_bpf__destroy(skel);
    return 0;
}
