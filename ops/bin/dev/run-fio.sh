#!/bin/bash

if [ $# -lt 2 ]; then
    echo "usage:$0 dev output_dir [iodepth]"
    echo "example 1: Testing the whole block device. Attention: That will destory the filesystem on the target block device"
    echo "./run_fio.sh /dev/sdb fio_test"
    echo ""
    echo "example 2: Testing a file, but not destory filesystem. Suppose the target device mount on /data"
    echo "dd if=/dev/urandom bs=1M count=16384 status=progress of=/data/test.dat && sync"
    echo "./run_fio.sh /data/test.dat fio_test"
    echo ""
    echo "Finally, it will genarate a certain result into the output_dir, like 'fio_test/fio_test.result"
    exit 1
fi

DEV="$1"
OUTDIR="$2"

if [ ! -d $OUTDIR ]; then
    mkdir -p $OUTDIR
fi

# default iodepth=8
IODEPTH=8
if [ $# -ge 3 ]; then
    if [ $3 -gt 0 ]; then
        IODEPTH=$3
    fi
fi
echo "IODEPTH=$IODEPTH"

RUNTIME=30
BLOCK_SIZES=(512 4K 128K 1M)
JOBS=(read write randread randwrite randrw)

# if you test randrw, you need to specify the rwmixreads in this array
RWMIXREADS=(50)

gen_job_file()
{
    # gen_job_file job block_size [rwmixread]
    job=$1
    block_size=$2
    echo "[global]" > $job
    echo "bs=$block_size" >> $job
    echo "direct=1" >> $job
    echo "buffered=0" >> $job
    echo "rw=$job" >> $job
    echo "ioengine=libaio" >> $job
    echo "iodepth=$IODEPTH" >> $job
    echo "runtime=$RUNTIME" >> $job
    if [ "$job" == "randwrite" -o "$job" == "randread" -o "$job" == "randrw" ]; then
        echo "randrepeat=0" >> $job
    fi
    echo "[test]" >> $job
    echo "filename=$DEV" >> $job
    if [ "$job" == "randrw" ]; then
        echo "rwmixread=$3" >> $job
    fi
}

cleanup()
{
    for job in "${JOBS[@]}"
    do
        rm -f $job
    done
    rm -f *.tmp
}

run_test()
{
    job=$1
    block_size=$2
    if [ $# -lt 3 ]; then
        output="$OUTDIR/fio.$job.$block_size.1.log"
    else
        output="$OUTDIR/fio.$job.$block_size.$3.1.log"
    fi
    fio --output-format=json --output="$output" $job
}

# run all the jobs
for job in "${JOBS[@]}"
do
    # generate job file for current job
    for block_size in "${BLOCK_SIZES[@]}"
    do
        if [ "$job" != "randrw" ]; then
            echo "run $job in $block_size"
            gen_job_file $job $block_size
            run_test $job $block_size
        else
            for rate in "${RWMIXREADS[@]}"
            do
                echo "run $job in $block_size, rwmixread=$rate"
                gen_job_file $job $block_size $rate
                run_test $job $block_size $rate
            done
        fi
    done
done

bw_array=()
iops_array=()
lat_array=()

select_bw()
{
    index=$1
    file=$2
    bw=$(cat $file | jq '[.jobs[0].write.bw_bytes, .jobs[0].read.bw_bytes] | if(.[0] > .[1]) then .[0] else .[1] end | tonumber * 100 / 1024 / 1024 | round / 100')
    bw_array[$index]="$bw"
}

select_iops()
{
    index=$1
    file=$2
    iops=$(cat $file | jq '[.jobs[0].write.iops, .jobs[0].read.iops] | if(.[0] > .[1]) then .[0] else .[1] end | tonumber * 100 / 1000 | round / 100')
    iops_array[$index]="$iops"
}

select_lat()
{
    index=$1
    file=$2
    lat=$(cat $file | jq '[.jobs[0].write.lat_ns.mean, .jobs[0].read.lat_ns.mean] | if(.[0] > .[1]) then .[0] else .[1] end | tonumber * 100  / 1000 / 1000 | round / 100')
    # unit:ms
    lat_array[$index]="$lat"
}

# use for test randrw
bw_array_rw_read=()
iops_array_rw_read=()
lat_array_rw_read=()
bw_array_rw_write=()
iops_array_rw_write=()
lat_array_rw_write=()

select_bw_rw()
{
    index=$1
    file=$2
    bw_read=$(cat $file | jq '.jobs[0].read.bw_bytes / 1024 / 1024 | tonumber * 100 | round / 100')
    bw_write=$(cat $file | jq '.jobs[0].write.bw_bytes / 1024 / 1024 | tonumber * 100 | round / 100')
    bw_array_rw_read[$index]="$bw_read"
    bw_array_rw_write[$index]="$bw_write"
}

select_iops_rw()
{
    index=$1
    file=$2
    iops_read=$(cat $file | jq '.jobs[0].read.iops | tonumber * 100 / 1000 | round / 100')
    iops_write=$(cat $file | jq '.jobs[0].write.iops | tonumber * 100 / 1000 | round / 100')
    iops_array_rw_read[$index]="$iops_read"
    iops_array_rw_write[$index]="$iops_write"
}

select_lat_rw()
{
    index=$1
    file=$2
    # unit:ms
    lat_read=$(cat $file | jq '.jobs[0].read.lat_ns.mean / 1000 / 1000 | tonumber * 100 | round / 100')
    lat_write=$(cat $file | jq '.jobs[0].write.lat_ns.mean / 1000 / 1000 | tonumber * 100 | round / 100')

    lat_array_rw_read[$index]="$lat_read"
    lat_array_rw_write[$index]="$lat_write"
}

# generate the test result table
output_file="$OUTDIR/$OUTDIR.result"
echo > "$output_file"
for job in "${JOBS[@]}"
do

    if [ "$job" != "randrw" ]; then

	echo -e "[$job]  \t$(echo "${BLOCK_SIZES[@]}" | tr ' ' '\t')" >> "$output_file"
        for (( i = 0; i < ${#BLOCK_SIZES[@]}; ++i ))
        do
            block_size=${BLOCK_SIZES[$i]}

            file="$OUTDIR/fio.$job.$block_size.1.log"
            echo $file
            select_bw $i $file
            select_iops $i $file
            select_lat $i $file
        done

	echo -e "[bw MB/s]\t$(echo "${bw_array[@]}" | tr ' ' '\t')" >> $output_file
	echo -e "[lat ms] \t$(echo "${lat_array[@]}" | tr ' ' '\t')" >> $output_file
	echo -e "[kIOPS]  \t$(echo "${iops_array[@]}" | tr ' ' '\t')" >> $output_file
        echo >> $output_file

        # clear array
        bw_array=()
        iops_array=()
        lat_array=()
    else
        for rate in "${RWMIXREADS[@]}"
        do
	    echo -e "[$job"_"$rate]\t$(echo "${BLOCK_SIZES[@]}" | tr ' ' '\t')" >> "$output_file"
            for (( i = 0; i < ${#BLOCK_SIZES[@]}; ++i ))
            do
                block_size=${BLOCK_SIZES[$i]}

                file="$OUTDIR/fio.$job.$block_size.$rate.1.log"
                echo $file
                select_bw_rw $i $file
                select_iops_rw $i $file
                select_lat_rw $i $file
            done

	    echo -e "[bw_read MB/s] \t$(echo "${bw_array_rw_read[@]}" | tr ' ' '\t')" >> $output_file
	    echo -e "[lat_read ms]  \t$(echo "${lat_array_rw_read[@]}" | tr ' ' '\t')" >> $output_file
	    echo -e "[kIOPS_read]   \t$(echo "${iops_array_rw_read[@]}" | tr ' ' '\t')" >> $output_file
	    echo -e "[bw_write MB/s]\t$(echo "${bw_array_rw_write[@]}" | tr ' ' '\t')" >> $output_file
	    echo -e "[lat_write ms] \t$(echo "${lat_array_rw_write[@]}" | tr ' ' '\t')" >> $output_file
	    echo -e "[kIOPS_write]  \t$(echo "${iops_array_rw_write[@]}" | tr ' ' '\t')" >> $output_file
            echo >> $output_file

            # clear array
            bw_array_rw_read=()
            iops_array_rw_read=()
            lat_array_rw_read=()
            bw_array_rw_write=()
            iops_array_rw_write=()
            lat_array_rw_write=()

        done

    fi
done

cat $output_file

cleanup
