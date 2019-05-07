<template>
    <section>
        <div>
            <br />
            <b-card 
            header="Projects"
            class="mx-auto"
            style="width: 85%"
            >
                <!-- Hyperloop -->
                <b-card
                class="mx-auto overflow-hidden"
                >
                    <Projects />
                </b-card>
            </b-card>

            <br />
        </div>
    </section>
</template>

<script>
import Projects from '~/components/Projects.vue'
export default {
    components: {
        Projects
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
