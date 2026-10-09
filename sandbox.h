#ifndef __SANDBOX_H
#define __SANDBOX_H

#define MAX_FILENAME_LEN 256

// Shared structure between Kernel eBPF and User-space Daemon
struct event_t {
    unsigned int pid;
    unsigned int uid;
    char comm[16];
    char filename[MAX_FILENAME_LEN];
};

#endif /* __SANDBOX_H */
