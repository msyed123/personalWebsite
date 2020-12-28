<template>
    <section>
        <div>
            <br />
            <b-card
            no-body
            style="width: 85%"
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="mx-auto"
            header="Loading..."
            v-if="loading"
            >
                <Loading />
            </b-card>
            <b-card
                class="mx-auto"
                style="width: 85%"
                border-variant="primary"
                header="Interests"
                header-bg-variant="primary"
                header-text-variant="white"
            v-else
            >
                <b-list-group>
                    <b-list-group-item v-for="interest in interests" v-bind:key="interest.data.priority">
                        {{ interest.data.name[0].text }}
                    </b-list-group-item>
                </b-list-group>
            </b-card>

            <br />
            <Progress />

            <br />
            <b-card
            class="mx-auto overflow-hidden"
            border-variant="primary"
            style="width: 85%"
            >
                <b-row no-gutters align-v="center">
                    <b-col md="4">
                        <b-card-img :src="require('../assets/msyed.jpg')" class="rounded-0"></b-card-img>
                    </b-col>
                    <b-col>
                        <b-card-body title="About Me">
                            <b-card-text>
                                I am a native born Floridian with the goal of trying to figure out how to make
                                things go up. Growing up on the Space Coast has greatly shaped who I am today.
                                I was always lucky to be within a stones throw of some of the cutting-edge work in
                                the field, and I quickly knew that aerospace was for me. Currently, I am a senior at
                                Florida Tech in Aerospace Engineering en route to graduate in the Spring of 2021. 
                                I do my best to keep myself busy with project I find interesting, ranging from leading
                                my school's inagural Hyperloop team, to desiging a solid-state sensor that can directly
                                quantify the amount of liquid water in lunar regolith. Currently, I am a member of the
                                <a href="https://research.fit.edu/dynamic-systems-and-controls-lab/" target="_blank">Florida Tech Dynamic Systems and Controls Lab</a>
                                where my current research involves developing and characterizing a visual-inertial navigation
                                control suite for eventual deployment on <a href="https://www.nasa.gov/astrobee" target="_blank">Astrobee</a>, a free-flying
                                robot on the Internation Space Station. 

                                I have always considered myself to be very fortunate. Because of this, I believe it is
                                incumbent upon me to try to give back to those around me in any way that I can. I volunteer
                                at schols around my district, mentoring a science research program at the middle school I
                                graduated from. I also volunteer at a drone program at the high school I graduated from. 
                            </b-card-text>
                        </b-card-body>
                    </b-col>
                </b-row>
            </b-card>
            <br />
        </div>
    </section>
</template>

<script>
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";
import Progress from '~/components/Progress.vue';
import Loading from "~/components/Loading.vue";

export default {
    data () {
        return {
            loading: true,
            interests: []
        }
    },

    methods: {
        async getInterests() {
            const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, {accessToken: process.env.PRISMIC_TOKEN});
            const response = await api.query(
                Prismic.Predicates.at("document.type", "interest"),
                { orderings : '[my.interest.priority]'}
            )
            this.interests = response.results;
            this.loading = false;
        }
    },

    created () {
        this.getInterests()
    },

    components: {
        Progress,
        Loading
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
