package net.airqo;

import io.confluent.kafka.serializers.AbstractKafkaSchemaSerDeConfig;
import io.confluent.kafka.streams.serdes.avro.SpecificAvroSerde;
import net.airqo.models.TransformedDeviceMeasurements;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.Serde;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.KeyValue;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.Produced;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CountDownLatch;

public class DeviceMeasurements {

    public static String INPUT_TOPIC;
    public static String OUTPUT_TOPIC;
    private static String TENANT;
    private static String SCHEMA_REGISTRY_URL;

    private static final Logger logger = LoggerFactory.getLogger(DeviceMeasurements.class);

    static Properties getStreamsConfig(String propertiesFile) {

        List<String> propKeys = new ArrayList<>();
        propKeys.add("bootstrap.servers");
        propKeys.add("input.topic");
        propKeys.add("tenant");
        propKeys.add("output.topic");
        propKeys.add("schema.registry.url");
        propKeys.add("application.id");

        final Properties properties = Utils.loadPropertiesFile(propertiesFile);
        final Properties envProperties = Utils.loadEnvProperties(propKeys);

        envProperties.forEach(properties::replace);

        try {

            if(!properties.containsKey("bootstrap.servers") ||
                    !properties.containsKey("input.topic") ||
                    !properties.containsKey("tenant") ||
                    !properties.containsKey("output.topic") ||
                    !properties.containsKey("schema.registry.url") ||
                    !properties.containsKey("application.id"))
                throw new IOException("Some properties are missing");

            INPUT_TOPIC = properties.getProperty("input.topic");
            OUTPUT_TOPIC = properties.getProperty("output.topic");
            TENANT = properties.getProperty("tenant");
            SCHEMA_REGISTRY_URL = properties.getProperty("schema.registry.url");

        }
        catch (IOException ex){
            System.err.println(ex.getMessage());
            System.exit(1);
        }

        properties.putIfAbsent(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.String().getClass().getName());
        properties.putIfAbsent(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, SpecificAvroSerde.class);
        properties.putIfAbsent(AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG, SCHEMA_REGISTRY_URL);
        properties.putIfAbsent(StreamsConfig.CACHE_MAX_BYTES_BUFFERING_CONFIG, 0);

//        props.putIfAbsent(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        return properties;

    }

    static void createMeasurementsStream(final StreamsBuilder builder) {

        final Map<String, String> serdeConfig = Collections.singletonMap(
                AbstractKafkaSchemaSerDeConfig.SCHEMA_REGISTRY_URL_CONFIG, SCHEMA_REGISTRY_URL);

        // `TransformedDeviceMeasurements` are Java classes generated from Avro schemas
        final Serde<TransformedDeviceMeasurements>
                valueSpecificAvroSerde = new SpecificAvroSerde<>();
        valueSpecificAvroSerde.configure(serdeConfig, false); // `false` for record values


        final KStream<String, String> source = builder
                .stream(INPUT_TOPIC, Consumed.with(Serdes.String(), Serdes.String()));

        final KStream<String, TransformedDeviceMeasurements> transformedList = source
                .map((key, value) -> new KeyValue<>("", Utils.generateTransformedOutput(Utils.transformMeasurements(value, TENANT))));


        transformedList.to(OUTPUT_TOPIC, Produced.valueSerde(valueSpecificAvroSerde) );
    }

    public static void main(final String[] args) {

        final Properties streamsConfiguration = getStreamsConfig("application.properties");

        logger.info("Started Connector");
        logger.info(new Date( System.currentTimeMillis()).toString());

        final StreamsBuilder builder = new StreamsBuilder();
        createMeasurementsStream(builder);

        final KafkaStreams streams = new KafkaStreams(builder.build(), streamsConfiguration);

        final CountDownLatch latch = new CountDownLatch(1);

        // attach shutdown handler to catch control-c
        Runtime.getRuntime().addShutdownHook(new Thread("streams-device-measurements-hook") {
            @Override
            public void run() {
                streams.close();
                latch.countDown();
            }
        });

        try {
            streams.start();
            latch.await();
        } catch (final Throwable e) {
            System.exit(1);
        }
        System.exit(0);
    }

}