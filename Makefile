# SPDX-License-Identifier: (LGPL-2.1 OR BSD-2-Clause)

APP = sandbox
ARCH ?= $(shell uname -m | sed 's/x86_64/x86/' | sed 's/aarch64/arm64/')
BPFTOOL ?= bpftool
CLANG ?= clang
CFLAGS := -g -O2 -Wall

# Directory for generated files
OUTPUT := .output

.PHONY: all clean

all: $(APP)

$(OUTPUT):
	mkdir -p $@

# Compile eBPF C code to BPF bytecode
$(OUTPUT)/%.bpf.o: %.bpf.c | $(OUTPUT)
	$(CLANG) -g -O2 -target bpf -D__TARGET_ARCH_$(ARCH) -c $< -o $@

# Generate BPF skeleton header
$(OUTPUT)/%.skel.h: $(OUTPUT)/%.bpf.o
	$(BPFTOOL) gen skeleton $< > $@

# Compile User-space C code
$(OUTPUT)/%.o: %.c $(OUTPUT)/$(APP).skel.h | $(OUTPUT)
	$(CLANG) $(CFLAGS) -I$(OUTPUT) -c $< -o $@

# Link the final user-space binary
$(APP): $(OUTPUT)/$(APP).o
	$(CLANG) $(CFLAGS) $< -lbpf -lelf -lz -o $@

clean:
	rm -rf $(OUTPUT) $(APP)
