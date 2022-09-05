<template>
    <section>
        <div>
            <br />
            <DraftOrder />
            <br />
        </div>
    </section>
</template>

<script>
import DraftOrder from '~/components/DraftOrder.vue'
export default {
    components: {
        DraftOrder
    }
}
</script>

<style>
    h1{
        padding-top: 20px;
        padding-left: 20px;
        text-align: left;
        font-family: monaco, monospace;
    }
    p {
        padding-top: 20px;
        padding-left: 20px;
        padding-right: 20px;
        text-align: left;
        font-family: monaco, monospace;
    }
</style>
